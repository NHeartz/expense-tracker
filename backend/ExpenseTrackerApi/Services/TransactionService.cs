using ExpenseTrackerApi.Data;
using ExpenseTrackerApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ExpenseTrackerApi.Services
{
    public interface ITransactionService
    {
        Task<object> GetPaginatedTransactionsAsync(int userId, int page, int pageSize, string? type, string? search);
        Task<IEnumerable<Transaction>> GetAllTransactionsAsync(int userId, string? search);
        Task<object> GetDashboardSummaryAsync(int userId);
        Task<Transaction> AddTransactionAsync(int userId, TransactionCreateDto request);
        Task<Transaction?> UpdateTransactionAsync(int transactionId, int userId, TransactionCreateDto request);
        Task<bool> DeleteTransactionAsync(int transactionId, int userId);
    }

    public class TransactionService : ITransactionService
    {
        private readonly ApplicationDbContext _context;

        public TransactionService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<object> GetPaginatedTransactionsAsync(int userId, int page, int pageSize, string? type, string? search)
        {
            var query = _context.Transactions.Where(t => t.UserId == userId);
            
            if (!string.IsNullOrEmpty(type))
            {
                query = query.Where(t => t.Type == type);
            }

            // ถ้ามีการพิมพ์ค้นหา ให้หาจาก Description (รายละเอียด) หรือ Category (หมวดหมู่)
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(t => (t.Description != null && t.Description.Contains(search)) || 
                                         (t.Category != null && t.Category.Contains(search)));
            }

            int total = await query.CountAsync();
            var items = await query
                .OrderByDescending(t => t.TransactionDate.Date)
                .ThenByDescending(t => t.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new { items, total };
        }

        public async Task<IEnumerable<Transaction>> GetAllTransactionsAsync(int userId, string? search)
        {
            var query = _context.Transactions.Where(t => t.UserId == userId);
            
            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(t => (t.Description != null && t.Description.Contains(search)) || 
                                         (t.Category != null && t.Category.Contains(search)));
            }

            return await query.OrderByDescending(t => t.TransactionDate.Date)
                              .ThenByDescending(t => t.Id)
                              .ToListAsync();
        }

        public async Task<object> GetDashboardSummaryAsync(int userId)
        {
            var rawData = await _context.Transactions
                .Where(t => t.UserId == userId)
                .Select(t => new { t.Type, t.Amount, t.Category, t.TransactionDate })
                .ToListAsync();

            // แปลงเวลาที่ดึงมาจากฐานข้อมูลให้เป็นโซนเวลาประเทศไทย (UTC+7) 
            // เพื่อป้องกันปัญหาตัดรอบเดือนผิดเพี้ยนจาก Timezone ของ Server
            var localData = rawData.Select(t => new {
                t.Type,
                t.Amount,
                Category = string.IsNullOrEmpty(t.Category) ? "อื่นๆ" : t.Category,
                TransactionDate = t.TransactionDate.AddHours(7)
            }).ToList();

            var categories = localData.Select(t => t.Category).Distinct().ToList();

            var monthlySummary = localData.GroupBy(t => new { t.TransactionDate.Year, t.TransactionDate.Month })
                .Select(g => new {
                    Year = g.Key.Year, Month = g.Key.Month,
                    Income = g.Where(x => x.Type == "INCOME").Sum(x => x.Amount),
                    Expense = g.Where(x => x.Type == "EXPENSE").Sum(x => x.Amount)
                }).ToList();

            var categorySummary = localData.Where(t => t.Type == "EXPENSE").GroupBy(t => new { t.TransactionDate.Year, t.TransactionDate.Month, Category = t.Category })
                .Select(g => new {
                    Year = g.Key.Year, Month = g.Key.Month, Category = g.Key.Category,
                    Amount = g.Sum(x => x.Amount)
                }).ToList();

            // ใช้เวลาปัจจุบันของโซนประเทศไทย (UTC+7) ในการเปรียบเทียบเดือนปัจจุบัน
            var currentMonth = DateTime.UtcNow.AddHours(7);
            var currentMonthIncome = localData.Where(t => t.TransactionDate.Year == currentMonth.Year && t.TransactionDate.Month == currentMonth.Month && t.Type == "INCOME").Sum(t => t.Amount);
            var currentMonthExpense = localData.Where(t => t.TransactionDate.Year == currentMonth.Year && t.TransactionDate.Month == currentMonth.Month && t.Type == "EXPENSE").Sum(t => t.Amount);

            return new {
                categories, monthlySummary, categorySummary, currentMonthIncome, currentMonthExpense,
                currentMonthBalance = currentMonthIncome - currentMonthExpense
            };
        }

        public async Task<Transaction> AddTransactionAsync(int userId, TransactionCreateDto request)
        {
            var transaction = new Transaction
            {
                UserId = userId,
                Type = request.Type,
                Amount = request.Amount,
                Category = request.Category,
                Description = request.Description,
                TransactionDate = request.TransactionDate
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return transaction;
        }

        public async Task<Transaction?> UpdateTransactionAsync(int transactionId, int userId, TransactionCreateDto request)
        {
            var transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == transactionId && t.UserId == userId);
            if (transaction == null) return null;

            transaction.Type = request.Type;
            transaction.Amount = request.Amount;
            transaction.Category = request.Category;
            transaction.Description = request.Description;
            transaction.TransactionDate = request.TransactionDate;

            await _context.SaveChangesAsync();
            return transaction;
        }

        public async Task<bool> DeleteTransactionAsync(int transactionId, int userId)
        {
            var transaction = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == transactionId && t.UserId == userId);
            if (transaction == null) return false;

            _context.Transactions.Remove(transaction);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}