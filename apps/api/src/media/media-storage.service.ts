import { Injectable } from "@nestjs/common";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

@Injectable()
export class MediaStorageService {
  readonly publicRoot = resolve(process.env.PUBLIC_ROOT ?? join(process.cwd(), "public"));

  async save(area: "avatars" | "reviews", buffer: Buffer, extension: string, prefix?: string) {
    const safeExtension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    const dir = join(this.publicRoot, "uploads", area);
    await mkdir(dir, { recursive: true });

    const id = randomUUID().replaceAll("-", "");
    const fileName = prefix ? `${prefix}-${id}${safeExtension}` : `${id}${safeExtension}`;
    await writeFile(join(dir, fileName), buffer);

    return `/uploads/${area}/${fileName}`;
  }

  async removePublicFile(publicPath: string | null | undefined): Promise<void> {
    if (!publicPath?.startsWith("/uploads/")) return;

    const candidate = resolve(
      this.publicRoot,
      normalize(publicPath.replace(/^\/+/, "")),
    );

    if (candidate !== this.publicRoot && !candidate.startsWith(`${this.publicRoot}${sep}`)) {
      return;
    }

    await rm(candidate, { force: true }).catch(() => undefined);
  }

  extensionFromName(name: string): string {
    return extname(name).toLowerCase();
  }
}
