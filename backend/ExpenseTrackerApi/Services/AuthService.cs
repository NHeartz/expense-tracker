using ExpenseTrackerApi.Controllers;
using ExpenseTrackerApi.Data;
using ExpenseTrackerApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ExpenseTrackerApi.Services
{
    public interface IAuthService
    {
        Task<(bool Success, string Message)> RegisterAsync(UserRegisterDto request);
        Task<(bool Success, string Message, string? Token, int? UserId)> LoginAsync(UserLoginDto request);
        Task<(bool Success, string Message)> ResetPasswordAsync(ResetPasswordDto request);
    }

    public class AuthService : IAuthService
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<(bool Success, string Message)> RegisterAsync(UserRegisterDto request)
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
            {
                return (false, "Username นี้มีผู้ใช้งานแล้ว");
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            var user = new User
            {
                Username = request.Username,
                PasswordHash = passwordHash
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return (true, "สมัครสมาชิกสำเร็จ!");
        }

        public async Task<(bool Success, string Message, string? Token, int? UserId)> LoginAsync(UserLoginDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return (false, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", null, null);
            }
            
            var token = GenerateJwtToken(user);
            
            return (true, "เข้าสู่ระบบสำเร็จ!", token, user.Id);
        }

        public async Task<(bool Success, string Message)> ResetPasswordAsync(ResetPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (user == null)
            {
                return (false, "ไม่พบชื่อผู้ใช้นี้ในระบบ!");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return (true, "เปลี่ยนรหัสผ่านสำเร็จ!");
        }

        private string GenerateJwtToken(User user)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.UniqueName, user.Username)
            };

            var token = new JwtSecurityToken(_configuration["Jwt:Issuer"], _configuration["Jwt:Audience"], claims, expires: DateTime.Now.AddDays(1), signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
