-- ================================================================
-- Migration: Add GioiTinh column to DanhMuc table
-- Date: 2026-08-12
-- ================================================================

USE KaitoKid;
GO

-- Check if column exists before adding
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('DanhMuc') 
    AND name = 'GioiTinh'
)
BEGIN
    ALTER TABLE DanhMuc
    ADD GioiTinh NVARCHAR(20) NOT NULL DEFAULT 'all';
    
    PRINT 'Added GioiTinh column to DanhMuc table';
END
ELSE
BEGIN
    PRINT 'GioiTinh column already exists in DanhMuc table';
END
GO
