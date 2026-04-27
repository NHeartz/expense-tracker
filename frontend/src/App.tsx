import React from 'react';
import { ConfigProvider } from 'antd';
import Login from './pages/Login';
import Home from './pages/Home';
import { useAuthStore } from './store/authStore';

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#ff758c', // ธีมสีชมพู
          fontFamily: "'Prompt', sans-serif", // ฟอนต์ Prompt
          borderRadius: 8,
          colorBgLayout: '#f9fafb',
        },
      }}
    >
      {isAuthenticated ? <Home /> : <Login />}
    </ConfigProvider>
  );
};

export default App;