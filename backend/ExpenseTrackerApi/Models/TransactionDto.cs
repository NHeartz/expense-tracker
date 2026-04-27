using System.ComponentModel.DataAnnotations;

namespace ExpenseTrackerApi.Models
{
    public class TransactionCreateDto
    {
        [Required, MaxLength(10)]
        public string Type { get; set; } = string.Empty; // "INCOME" หรือ "EXPENSE"

        [Required]
        public decimal Amount { get; set; }

        public string? Category { get; set; }

        public string? Description { get; set; }

        [Required]
        public DateTime TransactionDate { get; set; }
    }
}