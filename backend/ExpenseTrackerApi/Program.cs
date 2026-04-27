using ExpenseTrackerApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;
using ExpenseTrackerApi.Services; // อย่าลืม using Services

var builder = WebApplication.CreateBuilder(args);

// ส่วนที่เพิ่มเข้าไปเพื่อเชื่อมต่อ PostgreSQL
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// ลงทะเบียน AuthService ตรงนี้ครับ!
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITransactionService, TransactionService>(); // ลงทะเบียน TransactionService

// ตั้งค่า CORS เพื่ออนุญาตให้ React (Vite) เรียกใช้งาน API ได้
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.AllowAnyOrigin() // เปลี่ยนเป็นอนุญาตให้ทุกเว็บเรียกใช้งานได้ (เพื่อให้ Frontend บน Cloud เรียกได้)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ตั้งค่า Swagger ให้รองรับการใส่ Token
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "นำ Token ที่ได้จากการ Login มาวางที่นี่ได้เลย (ไม่ต้องพิมพ์คำว่า Bearer)",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new string[] {}
        }
    });
});

// ตั้งค่า JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Expense Tracker API v1");
        options.RoutePrefix = string.Empty; // ตั้งค่าให้ Swagger เปิดขึ้นมาที่หน้าแรกสุด (Root URL)
    });
}

app.UseHttpsRedirection();
app.UseCors("AllowReactApp"); // ต้องเรียกใช้ CORS ก่อน Authentication
app.UseAuthentication(); // ต้องมาก่อน Authorization
app.UseAuthorization();
app.MapControllers();

app.Run();
