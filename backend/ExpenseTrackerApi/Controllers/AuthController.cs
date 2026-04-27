using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using ExpenseTrackerApi.Models;
using ExpenseTrackerApi.Services;

namespace ExpenseTrackerApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(UserRegisterDto request)
        {
            var result = await _authService.RegisterAsync(request);
            if (!result.Success)
            {
                return BadRequest(result.Message);
            }

            return Ok(new { message = result.Message });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(UserLoginDto request)
        {
            var result = await _authService.LoginAsync(request);
            if (!result.Success)
            {
                return BadRequest(result.Message);
            }
            
            return Ok(new { message = result.Message, token = result.Token, userId = result.UserId });
        }

        [Authorize] // บังคับว่าต้องเข้าสู่ระบบ (มี Token) ถึงจะเรียกใช้งาน API นี้ได้
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            // ตรวจสอบความปลอดภัย: ดึง Username จาก Token และเทียบกับข้อมูลที่ส่งมา เพื่อป้องกันการเปลี่ยนรหัสผ่านบัญชีคนอื่น
            var tokenUsername = User.FindFirstValue("unique_name") ?? User.FindFirstValue(ClaimTypes.Name);
            if (!string.IsNullOrEmpty(tokenUsername) && tokenUsername != request.Username)
            {
                return StatusCode(403, new { message = "คุณไม่มีสิทธิ์เปลี่ยนรหัสผ่านของผู้ใช้อื่น!" });
            }

            var result = await _authService.ResetPasswordAsync(request);
            if (!result.Success)
            {
                return BadRequest(new { message = result.Message });
            }

            return Ok(new { message = result.Message });
        }
    }

    public class ResetPasswordDto
    {
        public string Username { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}