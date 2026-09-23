namespace API.Customer.DTOs;

public class RecommendationDTO
{
    public bool IsPersonalized { get; set; }
    public string Source { get; set; } = "fallback";
    public List<ProductDTO> Items { get; set; } = [];
}
