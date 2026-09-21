using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/categories")]
[Authorize]
public class AdminCategoriesController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    // [HasPermission("categories.view")] // Temporarily disabled for testing
    public async Task<IActionResult> GetAll()
    {
        var items = await db.DanhMuc.OrderBy(d => d.ThuTu).ToListAsync();
        return Ok(items);
    }

    [HttpPost]
    // [HasPermission("categories.manage")] // Temporarily disabled for testing
    public async Task<IActionResult> Create([FromBody] DanhMuc dm)
    {
        try
        {
            // Log để debug
            var userName = User?.Identity?.Name ?? "Anonymous";
            var claims = User?.Claims.Select(c => $"{c.Type}={c.Value}") ?? Array.Empty<string>();
            Console.WriteLine($"[DEBUG] Create Category - User: {userName}");
            Console.WriteLine($"[DEBUG] Claims: {string.Join(", ", claims)}");
            
            db.DanhMuc.Add(dm);
            await db.SaveChangesAsync();
            return Ok(dm);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Create Category failed: {ex.Message}");
            Console.WriteLine($"[ERROR] Stack: {ex.StackTrace}");
            return StatusCode(500, new { error = ex.Message, details = ex.StackTrace });
        }
    }

    [HttpPut("{id}")]
    // [HasPermission("categories.manage")] // Temporarily disabled for testing
    public async Task<IActionResult> Update(int id, [FromBody] DanhMuc dto)
    {
        try
        {
            Console.WriteLine($"[DEBUG] Update Category {id}");
            Console.WriteLine($"[DEBUG] TenDanhMuc: {dto.TenDanhMuc}");
            Console.WriteLine($"[DEBUG] GioiTinh: {dto.GioiTinh}");
            
            var dm = await db.DanhMuc.FindAsync(id);
            if (dm is null) return NotFound();
            
            dm.TenDanhMuc = dto.TenDanhMuc;
            dm.Slug = dto.Slug;
            dm.MoTa = dto.MoTa;
            dm.HinhAnh = dto.HinhAnh;
            dm.DanhMucChaId = dto.DanhMucChaId;
            dm.ThuTu = dto.ThuTu;
            dm.TrangThai = dto.TrangThai;
            dm.GioiTinh = dto.GioiTinh ?? "all";
            
            await db.SaveChangesAsync();
            return Ok(dm);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Update Category {id} failed: {ex.Message}");
            Console.WriteLine($"[ERROR] Stack: {ex.StackTrace}");
            return StatusCode(500, new { error = ex.Message, details = ex.StackTrace });
        }
    }

    [HttpDelete("{id}")]
    // [HasPermission("categories.manage")] // Temporarily disabled for testing
    public async Task<IActionResult> Delete(int id)
    {
        var dm = await db.DanhMuc.FindAsync(id);
        if (dm is null) return NotFound();
        db.DanhMuc.Remove(dm);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
// style: dinh dang lai code
