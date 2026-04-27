import React, { useState } from 'react';
import { Button, Form, Input, message, ConfigProvider } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { axiosClient } from '../api/axiosClient';
import './Login.css';

const Login: React.FC = () => {
  const setToken = useAuthStore((state) => state.setToken);
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState(1); // เพิ่ม State สำหรับจัดการขั้นตอน (1 = ใส่ชื่อ, 2 = ใส่รหัสใหม่)
  const [form] = Form.useForm(); // สร้าง form instance เพื่อใช้อ่านและสั่งรีเซ็ตค่า
  const [registerForm] = Form.useForm(); // สร้าง form instance สำหรับหน้าสมัครสมาชิก

  const onFinish = async (values: any) => {
    try {
      // ยิง API ไปที่ Backend เพื่อ Login
      const response = await axiosClient.post('/Auth/login', values);
      
      // เช็คว่ามี Token จริงๆ ถึงจะถือว่าสำเร็จ (เผื่อ Backend ส่ง Status 200 แต่บอกว่ารหัสผิด)
      if (response.data && response.data.token) {
        setToken(response.data.token);
        message.success('เข้าสู่ระบบสำเร็จ!');
        // เดี๋ยวเราจะทำ Redirect ไปหน้า Dashboard หลังจากนี้
      } else {
        // กรณีที่ Backend ส่งข้อมูลกลับมาเป็น 200 แต่ไม่มี Token (ล็อกอินไม่ผ่าน)
        message.error(response.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!');
      }
    } catch (error: any) {
      console.error('Login Error:', error.response || error); // พิมพ์ log ไว้ดูในหน้า Console เผื่อแก้บั๊ก
      
      // ดึงข้อความแจ้งเตือนให้ครอบคลุมทุกรูปแบบ
      let errMsg = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errMsg = error.response.data;
        } else if (error.response.data.message) {
          errMsg = error.response.data.message;
        }
      }
      message.error(errMsg);
    }
  };

  const onRegisterFinish = async (values: any) => {
    try {
      const response = await axiosClient.post('/Auth/register', values);
      
      if (response.data && response.data.success === false) {
        message.error(response.data.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      } else {
        message.success('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบด้วยบัญชีใหม่ของคุณ');
        registerForm.resetFields(); // ล้างข้อมูลในช่องกรอกสมัครสมาชิก
        setIsRightPanelActive(false); // สลับกลับมาหน้า Login เมื่อสมัครเสร็จ
      }
    } catch (error: any) {
      console.error('Register Error:', error.response || error);
      let errMsg = 'ชื่อผู้ใช้นี้มีคนใช้แล้ว หรือเกิดข้อผิดพลาด!';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errMsg = error.response.data;
        } else if (error.response.data.message) {
          errMsg = error.response.data.message;
        }
      }
      message.error(errMsg);
    }
  };

  // ฟังก์ชันสำหรับกดปุ่ม "ถัดไป"
  const handleNextStep = async () => {
    try {
      await form.validateFields(['username']); // เช็คว่ากรอกชื่อผู้ใช้หรือยัง
      setResetStep(2); // ถ้ากรอกแล้วให้ขยับไป Step 2
    } catch (error) {
      // ไม่ผ่าน validation จะมีข้อความเตือนใต้ช่องกรอกเอง
    }
  };

  // ฟังก์ชันสำหรับกดปุ่ม "เปลี่ยนรหัสผ่าน"
  const handleResetSubmit = async () => {
    try {
      const values = await form.validateFields(['username', 'newPassword']);
      
      // ยิง API ไปที่ Backend เพื่อเปลี่ยนรหัสผ่าน
      await axiosClient.post('/Auth/reset-password', { username: values.username, newPassword: values.newPassword });
      
      message.success('เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      setIsForgotPassword(false);
      setResetStep(1);
      form.setFieldValue('password', ''); // ล้างช่องรหัสผ่านเดิม
      form.setFieldValue('newPassword', ''); // ล้างช่องรหัสผ่านใหม่
    } catch (error: any) {
      console.error('Reset Password Error:', error.response || error); // พิมพ์ log ไว้ดูในหน้า Console เพื่อดีบัก
      let errMsg = 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
      
      // พยายามดึงข้อความ Error จาก Backend ให้ละเอียดที่สุด
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errMsg = error.response.data;
        } else if (data.message) {
          errMsg = data.message;
        } else if (data.title) { // รองรับ Error จาก ASP.NET Core Validation
          errMsg = data.title;
        } else if (data.errors) { // ดึงข้อความแรกจาก Validation
          const firstErrorKey = Object.keys(data.errors)[0];
          if (firstErrorKey && data.errors[firstErrorKey].length > 0) {
            errMsg = data.errors[firstErrorKey][0];
          }
        }
      }
      message.error(errMsg);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#ff758c', // เปลี่ยนสีหลักของ Ant Design เป็นสีชมพู
          fontFamily: "'Prompt', sans-serif", // เปลี่ยนฟอนต์ของส่วนประกอบ Ant Design ทั้งหมด
          borderRadius: 12, // ทำให้ขอบ Input และปุ่มโค้งมนขึ้น
          colorBgContainer: 'rgba(255, 255, 255, 0.8)', // ทำให้ Input โปร่งแสงนิดๆ
          controlHeightLG: 48, // เพิ่มความสูงของช่องกรอกให้ดูพรีเมียม
        },
      }}
    >
      <div className={`login-container ${isRightPanelActive ? 'right-panel-active' : ''}`}>
        
        {/* คอนเทนเนอร์ของข้อความชวนสมัคร/ล็อกอิน ที่ขยับตามวงกลมสีขาว */}
        <div className="overlay-container">
          {/* ข้อความตอนอยู่หน้า Login (วงกลมอยู่ขวา) */}
          <div className="overlay-panel overlay-right">
            <p className="register-text">ยังไม่มีบัญชีใช่ไหม?</p>
            <Button className="register-btn" size="large" onClick={() => setIsRightPanelActive(true)}>
              สมัครสมาชิก
            </Button>
          </div>
          
          {/* ข้อความตอนอยู่หน้า Register (วงกลมอยู่ซ้าย) */}
          <div className="overlay-panel overlay-left">
            <p className="register-text">มีบัญชีอยู่แล้ว?</p>
            <Button className="register-btn" size="large" onClick={() => setIsRightPanelActive(false)}>
              เข้าสู่ระบบ
            </Button>
          </div>
        </div>

        {/* ฟอร์มเข้าสู่ระบบ (ฝั่งซ้าย) */}
        <div className="form-container sign-in-container">
          <div className="login-card">
            <div className="login-header">
              <h2 className="login-title">Expense Tracker</h2>
              <p className="login-subtitle">
                {isForgotPassword ? 'รีเซ็ตรหัสผ่านของคุณ' : 'เข้าสู่ระบบเพื่อจัดการรายรับ-รายจ่าย'}
              </p>
            </div>

            {/* ผูก form={form} เข้ากับ Form ของ Ant Design */}
            <Form form={form} name="login" onFinish={onFinish} layout="vertical" size="large" requiredMark={false}>
              <Form.Item
                name="username"
                rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้!' }]}
              >
                {/* ถ้าอยู่ Step 2 จะล็อกช่อง Username ไม่ให้แก้ */}
                <Input prefix={<UserOutlined />} placeholder="ชื่อผู้ใช้ (Username)" disabled={isForgotPassword && resetStep === 2} />
              </Form.Item>

              {/* ส่วนที่ 1: กรอกรหัสผ่านและปุ่มล็อกอิน (ซ่อนเมื่อกดลืมรหัสผ่าน) */}
              <div className={`password-section ${isForgotPassword ? 'hidden' : ''}`}>
                <Form.Item
                  name="password"
                  rules={[{ required: !isForgotPassword, message: 'กรุณากรอกรหัสผ่าน!' }]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="รหัสผ่าน (Password)" />
                </Form.Item>

                <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotPassword(true); }} className="forgot-password-link">
                  ลืมรหัสผ่าน?
                </a>

                <Form.Item>
                  <Button type="primary" htmlType="submit" block className="login-btn">
                    เข้าสู่ระบบ
                  </Button>
                </Form.Item>
              </div>

              {/* ส่วนที่ 2: รีเซ็ตรหัสผ่าน (ขยายขึ้นมาเมื่อกดลืมรหัสผ่าน) */}
              <div className={`reset-section ${isForgotPassword ? 'expanded' : ''}`}>
                {resetStep === 1 ? (
                  <>
                    <p className="reset-desc">พิมพ์ชื่อผู้ใช้ของคุณด้านบน แล้วกด "ถัดไป" เพื่อตั้งรหัสผ่านใหม่</p>
                    <Form.Item>
                      <Button type="primary" htmlType="button" block className="login-btn" onClick={handleNextStep}>
                        ถัดไป
                      </Button>
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <p className="reset-desc">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
                    <Form.Item
                      name="newPassword"
                      rules={[{ required: isForgotPassword && resetStep === 2, message: 'กรุณากรอกรหัสผ่านใหม่!' }]}
                    >
                      <Input.Password prefix={<LockOutlined />} placeholder="รหัสผ่านใหม่ (New Password)" />
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="button" block className="login-btn" onClick={handleResetSubmit}>
                        เปลี่ยนรหัสผ่าน
                      </Button>
                    </Form.Item>
                  </>
                )}
                <Button type="link" block onClick={() => { setIsForgotPassword(false); setResetStep(1); }} style={{ color: '#666' }}>
                  ยกเลิก / กลับไปเข้าสู่ระบบ
                </Button>
              </div>
            </Form>
          </div>
        </div>

        {/* ฟอร์มสมัครสมาชิก (ฝั่งขวา) */}
        <div className="form-container sign-up-container">
          <div className="login-card">
            <div className="login-header">
              <h2 className="login-title">สร้างบัญชีใหม่</h2>
              <p className="login-subtitle">ลงทะเบียนเพื่อเริ่มต้นใช้งาน</p>
            </div>

            {/* ผูก form={registerForm} เพื่อให้สั่งล้างข้อมูลได้เมื่อสำเร็จ */}
            <Form form={registerForm} name="register" onFinish={onRegisterFinish} layout="vertical" size="large" requiredMark={false}>
              <Form.Item
                name="username"
                rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้!' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="ตั้งชื่อผู้ใช้ (Username)" />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน!' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="ตั้งรหัสผ่าน (Password)" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block className="login-btn">
                  ลงทะเบียน
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Login;