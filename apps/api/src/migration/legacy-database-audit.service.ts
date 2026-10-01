import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { LEGACY_TABLES, LEGACY_TABLE_COUNT } from "./legacy-table-manifest.js";

interface TableNameRow {
  TABLE_NAME: string;
}

interface LowerCaseTableNamesRow {
  LOWER_CASE_TABLE_NAMES: number | bigint | string;
}

export interface LegacyDatabaseAudit {
  expectedTableCount: number;
  actualTableCount: number;
  missingTables: string[];
  extraTables: string[];
  compatible: boolean;
  lowerCaseTableNames: number;
  tableNameComparison: "case-sensitive" | "case-insensitive";
}

@Injectable()
export class LegacyDatabaseAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async audit(): Promise<LegacyDatabaseAudit> {
    const [rows, settings] = await Promise.all([
      this.prisma.$queryRawUnsafe<TableNameRow[]>(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
      ),
      this.prisma.$queryRawUnsafe<LowerCaseTableNamesRow[]>(
        "SELECT @@lower_case_table_names AS LOWER_CASE_TABLE_NAMES",
      ),
    ]);

    const lowerCaseTableNames = Number(settings[0]?.LOWER_CASE_TABLE_NAMES ?? 0);
    const caseInsensitive = lowerCaseTableNames !== 0;
    const normalize = (table: string): string =>
      caseInsensitive ? table.toLowerCase() : table;

    const existingByNormalized = new Map(
      rows.map((row) => [normalize(row.TABLE_NAME), row.TABLE_NAME] as const),
    );
    const expectedNormalized = new Set(
      LEGACY_TABLES.map((table) => normalize(table)),
    );

    const missingTables = LEGACY_TABLES.filter(
      (table) => !existingByNormalized.has(normalize(table)),
    );
    const extraTables = rows
      .map((row) => row.TABLE_NAME)
      .filter((table) => !expectedNormalized.has(normalize(table)))
      .sort();

    return {
      expectedTableCount: LEGACY_TABLE_COUNT,
      actualTableCount: rows.length,
      missingTables,
      extraTables,
      compatible: missingTables.length === 0,
      lowerCaseTableNames,
      tableNameComparison: caseInsensitive ? "case-insensitive" : "case-sensitive",
    };
  }
}
