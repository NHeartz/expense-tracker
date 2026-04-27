# 1. ใช้ .NET SDK เพื่อ Build โค้ด
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# 2. คัดลอกไฟล์โปรเจกต์และดาวน์โหลดแพ็กเกจ (Restore)
COPY *.csproj ./
RUN dotnet restore

# 3. คัดลอกโค้ดทั้งหมดแล้วสั่ง Publish
COPY . ./
RUN dotnet publish -c Release -o out

# 4. ใช้ .NET Runtime ตัวเล็กสำหรับรันแอป
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/out ./

# 5. สั่งให้โปรแกรมทำงาน
ENTRYPOINT ["dotnet", "ExpenseTrackerApi.dll"]