using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ExpenseTrackerApi.Models;
using ExpenseTrackerApi.Services;
using System.Security.Claims;

namespace ExpenseTrackerApi.Controllers
{
    [Authorize] // คำสั่งนี้คือแม่กุญแจ! บังคับว่าต้องมี JWT Token ถึงจะเข้าใช้งาน API ในหน้านี้ได้
    [Route("api/[controller]")]
    [ApiController]
    public class TransactionsController : ControllerBase
    {
        private readonly ITransactionService _transactionService;

        public TransactionsController(ITransactionService transactionService)
        {
            _transactionService = transactionService;
        }

        // ฟังก์ชันช่วยดึง UserId ของคนที่ล็อกอินอยู่ จาก JWT Token
        private int GetCurrentUserId()
        {
            // ดึงค่า ID มาเช็คก่อน และรองรับเผื่อ Token ส่งมาในชื่อ "sub" 
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (int.TryParse(userIdClaim, out int userId))
            {
                return userId;
            }
            throw new UnauthorizedAccessException("ข้อมูลยืนยันตัวตนไม่สมบูรณ์ กรุณาเข้าสู่ระบบใหม่");
        }

        [HttpGet]
        public async Task<IActionResult> GetTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 8, [FromQuery] string? type = null, [FromQuery] string? search = null)
        {
            var userId = GetCurrentUserId();
            var result = await _transactionService.GetPaginatedTransactionsAsync(userId, page, pageSize, type, search);
            return Ok(result);
        }

        [HttpGet("export")]
        public async Task<IActionResult> ExportTransactions([FromQuery] string? search = null)
        {
            var userId = GetCurrentUserId();
            var transactions = await _transactionService.GetAllTransactionsAsync(userId, search);

            var builder = new System.Text.StringBuilder();
            builder.AppendLine("วันที่,ประเภท,หมวดหมู่,รายละเอียด,จำนวนเงิน(บาท)");

            foreach (var t in transactions)
            {
                var date = t.TransactionDate.AddHours(7).ToString("dd/MM/yyyy");
                var type = t.Type == "INCOME" ? "รายรับ" : "รายจ่าย";
                var category = string.IsNullOrEmpty(t.Category) ? "อื่นๆ" : t.Category;
                var desc = (t.Description ?? "").Replace(",", " "); // ป้องกันลูกน้ำชนกันในไฟล์ CSV
                var amount = t.Type == "INCOME" ? t.Amount.ToString("F2") : "-" + t.Amount.ToString("F2");

                builder.AppendLine($"{date},{type},{category},{desc},{amount}");
            }

            // เติม BOM (Byte Order Mark) เพื่อให้โปรแกรม Excel รองรับภาษาไทยได้สมบูรณ์แบบ 100%
            var bom = new byte[] { 0xEF, 0xBB, 0xBF };
            var bytes = bom.Concat(System.Text.Encoding.UTF8.GetBytes(builder.ToString())).ToArray();
            return File(bytes, "text/csv", "expense_history.csv");
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var userId = GetCurrentUserId();
            var result = await _transactionService.GetDashboardSummaryAsync(userId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> AddTransaction(TransactionCreateDto request)
        {
            var userId = GetCurrentUserId(); // เอาไอดีมาจาก Token อัตโนมัติ
            var transaction = await _transactionService.AddTransactionAsync(userId, request);

            return Ok(new { message = "บันทึกรายการสำเร็จ!", transaction });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTransaction(int id, TransactionCreateDto request)
        {
            var userId = GetCurrentUserId();
            var updatedTransaction = await _transactionService.UpdateTransactionAsync(id, userId, request);

            if (updatedTransaction == null)
            {
                return NotFound("ไม่พบรายการที่ต้องการแก้ไข หรือคุณไม่มีสิทธิ์แก้ไขรายการนี้");
            }

            return Ok(new { message = "แก้ไขรายการสำเร็จ!", transaction = updatedTransaction });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTransaction(int id)
        {
            var userId = GetCurrentUserId();
            var success = await _transactionService.DeleteTransactionAsync(id, userId);

            if (!success)
            {
                return NotFound("ไม่พบรายการที่ต้องการลบ หรือคุณไม่มีสิทธิ์ลบรายการนี้");
            }

            return Ok(new { message = "ลบรายการสำเร็จ!" });
        }
    }
}