using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecommendationsController(IProductService productService) : ControllerBase
{
    [HttpGet("for-me")]
    public async Task<ActionResult<RecommendationDTO>> GetForMe([FromQuery] int limit = 12)
    {
        int? userId = null;
        var rawUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(rawUserId, out var parsedUserId))
            userId = parsedUserId;

        return Ok(await productService.GetRecommendationsAsync(userId, limit));
    }
}
