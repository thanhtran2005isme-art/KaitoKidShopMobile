namespace API.Customer.DTOs;

public class PaymentConfigDTO
{
    public bool AllowSimulatePaid { get; set; }
    public List<string> SupportedMethods { get; set; } = [];
    public bool BankTransferConfigured { get; set; }
    public bool VietQrConfigured { get; set; }
}

public class PaymentBankAccountDTO
{
    public int Id { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountHolder { get; set; } = string.Empty;
    public string? Branch { get; set; }
    public string? QrImage { get; set; }
}

public class PaymentInstructionsDTO
{
    public string OrderCode { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public DateTime? PaymentExpiresAt { get; set; }
    public int SecondsLeft { get; set; }
    public string TransferContent { get; set; } = string.Empty;
    public PaymentBankAccountDTO? BankAccount { get; set; }
    public string? QrUrl { get; set; }
}
