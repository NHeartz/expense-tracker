import axios from 'axios';

// TODO: เช็ค Port ของ Backend คุณอีกครั้ง (ดูได้จาก Terminal ที่รัน dotnet run)
// เช่น http://localhost:5200 หรือ https://localhost:7198
const API_URL = 'https://expense-tracker-api-eg1x.onrender.com/api'; 

export const axiosClient = axios.create({
  baseURL: API_URL,
});

// ตัวดักจับ Request เพื่อแนบ Token
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});