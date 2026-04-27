using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ExpenseTrackerApi.Models
{
    public class Transaction
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required, MaxLength(10)]
        public string Type { get; set; } = string.Empty; // "INCOME" หรือ "EXPENSE"

        [Required, Column(TypeName = "decimal(12,2)")]
        public decimal Amount { get; set; }

        [MaxLength(50)]
        public string? Category { get; set; }

        public string? Description { get; set; }
        [Required]
        public DateTime TransactionDate { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public User? User { get; set; }
    }
}