import React, { useEffect, useState } from 'react';
import { Layout, Typography, Card, Statistic, Row, Col, Form, Input, InputNumber, Select, DatePicker, Button, Table, message, Tag, Popconfirm, Modal, ConfigProvider, Pagination, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, LogoutOutlined, WalletOutlined, DeleteOutlined, UserOutlined, KeyOutlined, EditOutlined, DownOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { axiosClient } from '../api/axiosClient';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import './Home.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

interface Transaction {
  id: number;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category?: string;
  description: string;
  transactionDate: string;
}

// ฟังก์ชันแปลงวันที่จาก Backend ให้รองรับ Timezone (UTC -> Local) ป้องกันปัญหาวันที่เหลื่อม
const parseDate = (dateStr: string) => {
  if (!dateStr) return dayjs();
  // ลบตัว Z ทิ้ง (ถ้ามี) แล้วบวก 7 ชั่วโมงเสมอ เพื่อล็อกเวลาให้ตรงกับเซิร์ฟเวอร์
  const rawDate = dateStr.replace('Z', '');
  return dayjs(rawDate).add(7, 'hour');
};

// เตรียมชื่อเดือนภาษาไทย และฟังก์ชันแปลงวันที่เป็นแบบไทย (เช่น มกราคม 68)
const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const formatMonthYearTh = (date: string) => {
  const d = parseDate(date);
  const month = thaiMonths[d.month()];
  const year = (d.year() + 543).toString().slice(-2);
  return `${month} ${year}`;
};

// เตรียมหมวดหมู่พื้นฐาน (หมวดหมู่ที่จะมีให้เลือกเสมอ)
const defaultCategories = [
  'อาหาร', 'ที่พัก', 'ค่าเดินทาง', 'ช้อปปิ้ง', 'บันเทิง', 'สุขภาพ', 'เงินเดือน'
];

const Home: React.FC = () => {
  const { logout } = useAuthStore();
  const token = useAuthStore((state: any) => state.token); // ดึง Token จาก Store เพื่อถอดรหัส
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm(); // ฟอร์มสำหรับเปลี่ยนรหัสผ่าน
  const [editForm] = Form.useForm(); // ฟอร์มสำหรับแก้ไขรายการ
  const [txs, setTxs] = useState<{items: Transaction[], total: number}>({items: [], total: 0});
  const [incomeTxs, setIncomeTxs] = useState<{items: Transaction[], total: number}>({items: [], total: 0});
  const [expenseTxs, setExpenseTxs] = useState<{items: Transaction[], total: number}>({items: [], total: 0});
  const [dashboard, setDashboard] = useState<any>({
    categories: [], monthlySummary: [], categorySummary: [],
    currentMonthIncome: 0, currentMonthExpense: 0, currentMonthBalance: 0
  });
  const [loading, setLoading] = useState(false);
  const [isIncomeModalVisible, setIsIncomeModalVisible] = useState(false);
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [isAllModalVisible, setIsAllModalVisible] = useState(false);
  const [isBalanceModalVisible, setIsBalanceModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isPieChartModalVisible, setIsPieChartModalVisible] = useState(false);
  const [isBarChartModalVisible, setIsBarChartModalVisible] = useState(false);
  const [selectedMonthForPie, setSelectedMonthForPie] = useState(dayjs());
  const [selectedYearForBar, setSelectedYearForBar] = useState(dayjs());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [page, setPage] = useState(1);
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // คอยเฝ้าดูค่าในช่อง "หมวดหมู่" ตลอดเวลา เพื่อใช้เปิด/ปิดช่องกรอกหมวดหมู่เพิ่มเติม
  const selectedCategory = Form.useWatch('category', form);
  const editSelectedCategory = Form.useWatch('category', editForm);
  const [username, setUsername] = useState<string>('ผู้ใช้งาน');

  // แปลง JWT Token เพื่อดึงชื่อผู้ใช้มาแสดง
  useEffect(() => {
    if (token) {
      try {
        // ป้องกัน Error จากตัวอักษรภาษาไทย (UTF-8) ด้วยการเข้ารหัส/ถอดรหัสแบบพิเศษ
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        
        // ค้นหาฟิลด์ชื่อผู้ใช้ตามรูปแบบที่ Backend (ASP.NET) มักจะใช้
        const name = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || payload.name || payload.sub;
        if (name) setUsername(name);
      } catch (error) {
        console.error('ไม่สามารถอ่านข้อมูลผู้ใช้จาก Token ได้', error);
      }
    }
  }, [token]);

  const fetchTransactionsData = async (p: number, type?: string, search?: string) => {
    const res = await axiosClient.get('/Transactions', { params: { page: p, pageSize: 8, type, search } });
    return res.data;
  };

  const loadMainTxs = async (p: number) => { setPage(p); setTxs(await fetchTransactionsData(p, undefined, searchKeyword)); };
  const loadIncomeTxs = async (p: number) => { setIncomePage(p); setIncomeTxs(await fetchTransactionsData(p, 'INCOME', searchKeyword)); };
  const loadExpenseTxs = async (p: number) => { setExpensePage(p); setExpenseTxs(await fetchTransactionsData(p, 'EXPENSE', searchKeyword)); };

  const loadDashboard = async () => {
    const res = await axiosClient.get('/Transactions/summary');
    setDashboard(res.data);
    const uniqueCategories = Array.from(new Set([...defaultCategories, ...res.data.categories]));
    setCategories(uniqueCategories.filter(c => c !== 'อื่นๆ'));
  };

  const refreshAllData = () => {
    setLoading(true);
    Promise.all([
      fetchTransactionsData(page, undefined, searchKeyword).then(d => setTxs(d)),
      fetchTransactionsData(incomePage, 'INCOME', searchKeyword).then(d => setIncomeTxs(d)),
      fetchTransactionsData(expensePage, 'EXPENSE', searchKeyword).then(d => setExpenseTxs(d)),
      loadDashboard()
    ])
      .finally(() => setLoading(false));
  };

  // ดึงข้อมูลครั้งแรกเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    refreshAllData();
  }, []);

  // ฟังก์ชันสำหรับการค้นหา (รีเซ็ตทุกตารางกลับไปหน้า 1)
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setLoading(true);
    Promise.all([
      fetchTransactionsData(1, undefined, value).then(d => { setPage(1); setTxs(d); }),
      fetchTransactionsData(1, 'INCOME', value).then(d => { setIncomePage(1); setIncomeTxs(d); }),
      fetchTransactionsData(1, 'EXPENSE', value).then(d => { setExpensePage(1); setExpenseTxs(d); })
    ]).finally(() => setLoading(false));
  };

  // ฟังก์ชันดาวน์โหลดประวัติเป็นไฟล์ CSV (Excel)
  const handleExport = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/Transactions/export', {
        params: { search: searchKeyword },
        responseType: 'blob', // สำคัญมาก เพื่อระบุว่าข้อมูลที่ได้รับมาคือไฟล์ ไม่ใช่ JSON
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ประวัติรายการบัญชี_${dayjs().format('YYYYMMDD')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('ดาวน์โหลดไฟล์สำเร็จ!');
    } catch (error) {
      message.error('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันเมื่อกดปุ่มบันทึกรายการใหม่
  const onFinish = async (values: any) => {
    try {
      // ตรวจสอบว่าถ้าผู้ใช้เลือก "อื่นๆ" ให้ดึงค่าจากช่อง customCategory มาใช้เป็นชื่อหมวดหมู่จริงๆ
      let finalCategory = values.category;
      if (values.category === 'อื่นๆ' && values.customCategory) {
        finalCategory = values.customCategory;
      }

      // แปลงวันที่ให้เป็นรูปแบบที่ Backend เข้าใจ
      const payload = {
        ...values,
        category: finalCategory,
        // เติม .000Z ต่อท้าย เพื่อให้ตรงตามมาตรฐาน ISO 8601 ที่ Backend (C#) ต้องการเป๊ะๆ
        transactionDate: values.transactionDate.format('YYYY-MM-DDT12:00:00.000[Z]'),
      };
      delete payload.customCategory; // ไม่ต้องส่งฟิลด์ customCategory ไปที่ Backend

      await axiosClient.post('/Transactions', payload);
      message.success('บันทึกรายการสำเร็จ!');
      form.resetFields(); // ล้างข้อมูลในฟอร์ม
      refreshAllData(); // ดึงข้อมูลใหม่มาอัปเดตตาราง
    } catch (error: any) {
      console.error('Save Error:', error.response?.data || error);
      message.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  };

  // ฟังก์ชันเปิด Modal แก้ไขและเติมข้อมูลเดิม
  const handleEditClick = (record: Transaction) => {
    setEditingId(record.id);
    const isCustomCategory = record.category && !categories.includes(record.category) && record.category !== 'อื่นๆ';
    
    editForm.setFieldsValue({
      type: record.type,
      amount: record.amount,
      category: isCustomCategory ? 'อื่นๆ' : (record.category || 'อื่นๆ'),
      customCategory: isCustomCategory ? record.category : '',
      description: record.description,
      transactionDate: parseDate(record.transactionDate),
    });
    setIsEditModalVisible(true);
  };

  // ฟังก์ชันเมื่อกดปุ่มแก้ไขรายการ
  const onEditFinish = async (values: any) => {
    try {
      let finalCategory = values.category;
      if (values.category === 'อื่นๆ' && values.customCategory) {
        finalCategory = values.customCategory;
      }

      const payload = {
        ...values,
        category: finalCategory,
        // เติม .000Z ต่อท้ายเช่นกัน
        transactionDate: values.transactionDate.format('YYYY-MM-DDT12:00:00.000[Z]'),
      };
      delete payload.customCategory;

      await axiosClient.put(`/Transactions/${editingId}`, payload);
      message.success('แก้ไขรายการสำเร็จ!');
      setIsEditModalVisible(false);
      refreshAllData();
    } catch (error: any) {
      console.error('Edit Error:', error.response?.data || error);
      message.error('เกิดข้อผิดพลาดในการแก้ไขข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  };

  // ฟังก์ชันลบรายการ
  const handleDelete = async (id: number) => {
    try {
      await axiosClient.delete(`/Transactions/${id}`);
      message.success('ลบรายการสำเร็จ!');
      refreshAllData(); // ดึงข้อมูลใหม่มาอัปเดตตารางทันที
    } catch (error) {
      message.error('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  // ฟังก์ชันเปลี่ยนรหัสผ่าน
  const onChangePassword = async (values: any) => {
    try {
      await axiosClient.post('/Auth/reset-password', {
        username: username,
        newPassword: values.newPassword
      });
      message.success('เปลี่ยนรหัสผ่านสำเร็จ!');
      setIsPasswordModalVisible(false);
      passwordForm.resetFields(); // ล้างฟอร์ม
    } catch (error: any) {
      console.error('Change Password Error:', error.response || error);
      let errMsg = 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
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

  // เมนูสำหรับ Dropdown โปรไฟล์ผู้ใช้
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: 'เปลี่ยนรหัสผ่าน',
      onClick: () => setIsPasswordModalVisible(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'ออกจากระบบ',
      danger: true,
      onClick: logout,
    },
  ];

  // ข้อมูลสรุปยอดคงเหลือแบบรายเดือนสำหรับ Modal ยอดเงินคงเหลือ
  const monthlySummaryData = [...dashboard.monthlySummary].sort((a: { year: number, month: number }, b: { year: number, month: number }) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  }).map((x: any) => ({
    id: `${x.year}-${x.month}`,
    monthLabel: `${thaiMonths[x.month - 1]} ${(x.year + 543).toString().slice(-2)}`,
    income: x.income,
    expense: x.expense,
    balance: x.income - x.expense
  }));

  // ---------- ข้อมูลสำหรับ Dashboard ----------
  // 1. ฟังก์ชันคำนวณข้อมูล PieChart ตามเดือนที่เลือก
  const getPieDataForMonth = (targetMonth: dayjs.Dayjs) => {
    const y = targetMonth.year();
    const m = targetMonth.month() + 1;
    const catData = dashboard.categorySummary.filter((x: any) => x.year === y && x.month === m);
    return catData.map((x: any) => ({
      name: x.category,
      value: x.amount
    })).sort((a: any, b: any) => b.value - a.value);
  };

  const pieData = getPieDataForMonth(dayjs()); // สำหรับหน้าหลัก (เดือนปัจจุบันเสมอ)
  const modalPieData = getPieDataForMonth(selectedMonthForPie); // สำหรับ Modal (เปลี่ยนตามเลือก)

  const COLORS = ['#ff758c', '#ff7eb3', '#fa8c16', '#ffbb28', '#13c2c2', '#52c41a', '#1890ff', '#722ed1'];

  // 2. ข้อมูล BarChart (เปรียบเทียบรายรับ-รายจ่าย 6 เดือนย้อนหลัง)
  const barData: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = dayjs().subtract(i, 'month');
    const y = d.year();
    const m = d.month() + 1;
    const match = dashboard.monthlySummary.find((x: any) => x.year === y && x.month === m);
    barData.push({
      name: `${thaiMonths[m - 1]} ${(y + 543).toString().slice(-2)}`,
      รายรับ: match ? match.income : 0,
      รายจ่าย: match ? match.expense : 0
    });
  }

  // 3. ข้อมูล BarChart สำหรับหน้าต่าง Modal (ดึงทั้ง 12 เดือนของปีที่เลือก)
  const getBarDataForYear = (targetYear: dayjs.Dayjs) => {
    const year = targetYear.year();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const m = i + 1;
      const match = dashboard.monthlySummary.find((x: any) => x.year === year && x.month === m);
      months.push({
        name: thaiMonths[i],
        รายรับ: match ? match.income : 0,
        รายจ่าย: match ? match.expense : 0
      });
    }
    return months;
  };
  const modalBarData = getBarDataForYear(selectedYearForBar);
  // ---------------------------------------------

  // แปลงข้อมูลสำหรับแสดงผลในตาราง โดยแทรกแถวคั่นเดือน
  const generateTableDataWithSeparators = (data: Transaction[]) => {
    const result: any[] = [];
    let currentMonth = '';

    data.forEach(t => {
      const monthLabel = formatMonthYearTh(t.transactionDate);
      if (monthLabel !== currentMonth) {
        const d = parseDate(t.transactionDate);
        const mData = dashboard.monthlySummary.find((m: any) => m.year === d.year() && m.month === (d.month() + 1));
        result.push({
          id: `sep-${monthLabel}-${t.id}`, // ป้องกัน id ซ้ำ
          isSeparator: true,
          separatorLabel: monthLabel,
          transactionDate: t.transactionDate, // ให้ยังคงมีวันที่เผื่อระบบ sort
          monthIncome: mData ? mData.income : 0,
          monthExpense: mData ? mData.expense : 0,
        });
        currentMonth = monthLabel;
      }
      result.push(t);
    });
    return result;
  };

  const displayTransactions = generateTableDataWithSeparators(txs.items);
  const displayIncomeTransactions = generateTableDataWithSeparators(incomeTxs.items);
  const displayExpenseTransactions = generateTableDataWithSeparators(expenseTxs.items);

  // ตั้งค่าคอลัมน์ของตาราง
  const columns = [
    {
      title: 'วันที่',
      dataIndex: 'transactionDate',
      key: 'transactionDate',
      render: (date: string, record: any) => {
        if (record.isSeparator) {
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '16px' }}>
              <span style={{ color: '#ff758c', fontWeight: 600, fontSize: '15px' }}>
                เดือน {record.separatorLabel}
              </span>
              <div>
                <span style={{ color: '#52c41a', fontWeight: 500, marginRight: '16px', fontSize: '14px' }}>
                  รายรับรวม: +฿{record.monthIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span style={{ color: '#ff4d4f', fontWeight: 500, fontSize: '14px' }}>
                  รายจ่ายรวม: -฿{record.monthExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        }
        return parseDate(date).format('DD/MM/YYYY');
      },
      onCell: (record: any) => ({
        colSpan: record.isSeparator ? 6 : 1, // ถ้านี่คือแถวคั่นเดือน ให้รวม 6 คอลัมน์เป็น 1 แถวยาว
        style: record.isSeparator ? { backgroundColor: '#fff0f5' } : {}, // ใส่สีพื้นหลังให้แถวคั่นโดดเด่น
      }),
    },
    {
      title: 'ประเภท',
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: any) => {
        if (record.isSeparator) return null;
        return (
          <Tag color={type === 'INCOME' ? 'success' : 'error'}>
            {type === 'INCOME' ? 'รายรับ' : 'รายจ่าย'}
          </Tag>
        );
      },
      onCell: (record: any) => ({ colSpan: record.isSeparator ? 0 : 1 }), // ซ่อนช่องเมื่อเป็นแถวคั่น
    },
    {
      title: 'หมวดหมู่',
      dataIndex: 'category',
      key: 'category',
      filters: [...categories, 'อื่นๆ'].map(c => ({ text: c, value: c })), // ดึงตัวกรองจากหมวดหมู่ที่มีทั้งหมดอัตโนมัติ
      onFilter: (value: any, record: any) => {
        if (record.isSeparator) return false;
        return record.category === value;
      },
      render: (category: string, record: any) => {
        if (record.isSeparator) return null;
        return category ? <Tag color="blue">{category}</Tag> : <span className="empty-category">-</span>;
      },
      onCell: (record: any) => ({ colSpan: record.isSeparator ? 0 : 1 }),
    },
    {
      title: 'รายละเอียด',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string, record: any) => {
        if (record.isSeparator) return null;
        return desc;
      },
      onCell: (record: any) => ({ colSpan: record.isSeparator ? 0 : 1 }),
    },
    {
      title: 'จำนวนเงิน',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => {
        if (record.isSeparator) return null;
        return (
          <span className={record.type === 'INCOME' ? 'amount-income' : 'amount-expense'}>
            {record.type === 'INCOME' ? '+' : '-'} ฿{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
      onCell: (record: any) => ({ colSpan: record.isSeparator ? 0 : 1 }),
    },
    {
      title: 'จัดการ',
      key: 'action',
      render: (_: any, record: any) => {
        if (record.isSeparator) return null;
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="text" icon={<EditOutlined />} style={{ color: '#1890ff' }} onClick={() => handleEditClick(record)} />
            <Popconfirm
              title="ยืนยันการลบ"
              description="คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?"
              onConfirm={() => handleDelete(record.id)}
              okText="ลบ"
              cancelText="ยกเลิก"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        );
      },
      onCell: (record: any) => ({ colSpan: record.isSeparator ? 0 : 1 }),
    },
  ];

  // ตั้งค่าคอลัมน์ของตารางสรุปรายเดือน
  const balanceColumns = [
    {
      title: 'เดือน',
      dataIndex: 'monthLabel',
      key: 'monthLabel',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#ff758c' }}>{text}</span>,
    },
    {
      title: 'รายรับ',
      dataIndex: 'income',
      key: 'income',
      render: (val: number) => <span className="amount-income">+ ฿{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'รายจ่าย',
      dataIndex: 'expense',
      key: 'expense',
      render: (val: number) => <span className="amount-expense">- ฿{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: 'ยอดคงเหลือ',
      dataIndex: 'balance',
      key: 'balance',
      render: (val: number) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {val >= 0 ? '+' : '-'} ฿{Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#ff758c', // สีหลักธีมเดียวกับหน้า Login
          fontFamily: "'Prompt', sans-serif",
          colorBgLayout: 'transparent', // ทำให้ Layout โปร่งใสเพื่อโชว์สีพื้นหลัง Gradient
        },
      }}
    >
      <Layout className="home-layout">
      {/* แถบเมนูด้านบน */}
      <Header className="home-header">
        <Title level={3} className="home-title">
          <WalletOutlined style={{ marginRight: 8 }} /> Expense Tracker
        </Title>
        <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight" onOpenChange={(open) => setIsDropdownOpen(open)}>
          <div className="user-dropdown-trigger" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px' }}>
            <UserOutlined style={{ color: '#ff758c', fontSize: '18px' }} />
            <span style={{ fontWeight: 500, color: '#444' }}>{username}</span>
            <DownOutlined style={{ fontSize: '12px', color: '#888', transition: 'transform 0.3s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </div>
        </Dropdown>
      </Header>

      <Content className="home-content">
        {/* ส่วนที่ 1: การ์ดสรุปยอด */}
        <Row gutter={[16, 16]} className="stat-row">
          <Col xs={24} md={8}>
            <Card bordered={false} className="stat-card" hoverable onClick={() => setIsBalanceModalVisible(true)}>
              <Statistic title="ยอดเงินคงเหลือ (เดือนนี้)" value={dashboard.currentMonthBalance} precision={2} prefix="฿" className={dashboard.currentMonthBalance >= 0 ? 'stat-balance-positive' : 'stat-balance-negative'} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered={false} className="stat-card" hoverable onClick={() => setIsIncomeModalVisible(true)}>
              <Statistic title="รายรับ (เดือนนี้)" value={dashboard.currentMonthIncome} precision={2} prefix={<ArrowUpOutlined />} className="stat-income" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered={false} className="stat-card" hoverable onClick={() => setIsExpenseModalVisible(true)}>
              <Statistic title="รายจ่าย (เดือนนี้)" value={dashboard.currentMonthExpense} precision={2} prefix={<ArrowDownOutlined />} className="stat-expense" />
            </Card>
          </Col>
        </Row>

        {/* ส่วนที่ 1.5: Dashboard (กราฟ) */}
        <Row gutter={[24, 24]} className="stat-row">
          <Col xs={24} lg={12}>
            <Card 
              title="สัดส่วนรายจ่ายตามหมวดหมู่ (เดือนนี้)" 
              bordered={false} 
              className="stat-card" 
              style={{ height: '100%' }}
              extra={<Button type="link" onClick={() => setIsPieChartModalVisible(true)} style={{ fontWeight: 500 }}>ดูเพิ่มเติม</Button>}
            >
              {pieData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                  ไม่มีข้อมูลรายจ่ายในเดือนนี้
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card 
              title="เปรียบเทียบรายรับ-รายจ่าย (6 เดือนล่าสุด)" 
              bordered={false} 
              className="stat-card" 
              style={{ height: '100%' }}
              extra={<Button type="link" onClick={() => setIsBarChartModalVisible(true)} style={{ fontWeight: 500 }}>ดูเพิ่มเติม</Button>}
            >
              {barData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(value: any) => `฿${value}`} width={80} />
                      <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} cursor={{ fill: '#f5f5f5' }} />
                      <Legend iconType="circle" />
                      <Bar dataKey="รายรับ" fill="#52c41a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="รายจ่าย" fill="#ff4d4f" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                  ไม่มีข้อมูล
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          {/* ส่วนที่ 2: ฟอร์มเพิ่มรายการ */}
          <Col xs={24} lg={8}>
            <Card title="บันทึกรายการใหม่" bordered={false} className="form-card">
              <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ transactionDate: dayjs() }}>
                <Form.Item name="type" label="ประเภท" rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}>
                  <Select placeholder="เลือกรายรับ / รายจ่าย">
                    <Option value="INCOME">รายรับ</Option>
                    <Option value="EXPENSE">รายจ่าย</Option>
                  </Select>
                </Form.Item>
                
                <Form.Item name="amount" label="จำนวนเงิน" rules={[{ required: true, message: 'กรุณากรอกจำนวนเงิน' }]}>
                  <InputNumber className="full-width-input" placeholder="0.00" min={0.01} step={10} prefix="฿" />
                </Form.Item>

                <Form.Item name="category" label="หมวดหมู่" rules={[{ required: true, message: 'กรุณาเลือกหมวดหมู่' }]}>
                  <Select placeholder="เลือกหมวดหมู่">
                    {categories.map(c => (
                      <Option key={c} value={c}>{c}</Option>
                    ))}
                    <Option value="อื่นๆ">อื่นๆ</Option>
                  </Select>
                </Form.Item>

                {selectedCategory === 'อื่นๆ' && (
                  <Form.Item 
                    name="customCategory" 
                    label="ระบุหมวดหมู่เพิ่มเติม" 
                    rules={[{ required: true, message: 'กรุณาระบุหมวดหมู่ใหม่' }]}
                  >
                    <Input placeholder="พิมพ์หมวดหมู่ใหม่" />
                  </Form.Item>
                )}

                <Form.Item name="description" label="รายละเอียด (ตัวเลือก)">
                  <Input placeholder="เช่น ผัดกระเพรา ,ชานม" />
                </Form.Item>

                <Form.Item name="transactionDate" label="วันที่" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
                  <DatePicker className="full-width-input" format="DD/MM/YYYY" placeholder="เลือกวันที่" allowClear={false} />
                </Form.Item>

                <Form.Item className="submit-form-item">
                  <Button type="primary" htmlType="submit" block size="large">
                    บันทึกรายการ
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* ส่วนที่ 3: ตารางแสดงประวัติ */}
          <Col xs={24} lg={16}>
            <Card 
              title="ประวัติรายการล่าสุด" 
              bordered={false} 
              className="table-card"
              extra={
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Input.Search placeholder="ค้นหาหมวดหมู่, รายละเอียด..." onSearch={handleSearch} allowClear style={{ width: 220 }} />
                  <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} style={{ backgroundColor: '#52c41a' }}>Export</Button>
                  <Button type="link" onClick={() => setIsAllModalVisible(true)} style={{ fontWeight: 500 }}>ดูเพิ่มเติม</Button>
                </div>
              }
            >
              <Table columns={columns} dataSource={displayTransactions} rowKey="id" loading={loading} pagination={false} scroll={{ x: 'max-content' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Pagination current={page} pageSize={8} total={txs.total} onChange={loadMainTxs} showSizeChanger={false} />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Modal แสดงประวัติรายการทั้งหมด (แบบขยายกว้าง) */}
        <Modal
          title="ประวัติรายการทั้งหมด"
          open={isAllModalVisible}
          onCancel={() => setIsAllModalVisible(false)}
          footer={null}
          width={1000}
          style={{ top: 20 }}
        >
          <Table columns={columns} dataSource={displayTransactions} rowKey="id" loading={loading} pagination={false} scroll={{ x: 'max-content' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination current={page} pageSize={8} total={txs.total} onChange={loadMainTxs} showSizeChanger={false} />
          </div>
        </Modal>

        {/* Modal แสดงรายละเอียดรายรับทั้งหมด */}
        <Modal
          title="รายละเอียดรายรับทั้งหมด"
          open={isIncomeModalVisible}
          onCancel={() => setIsIncomeModalVisible(false)}
          footer={null}
          width={800}
        >
          <Table columns={columns} dataSource={displayIncomeTransactions} rowKey="id" loading={loading} pagination={false} scroll={{ x: 'max-content' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination current={incomePage} pageSize={8} total={incomeTxs.total} onChange={loadIncomeTxs} showSizeChanger={false} />
          </div>
        </Modal>

        {/* Modal แสดงรายละเอียดรายจ่ายทั้งหมด */}
        <Modal
          title="รายละเอียดรายจ่ายทั้งหมด"
          open={isExpenseModalVisible}
          onCancel={() => setIsExpenseModalVisible(false)}
          footer={null}
          width={800}
        >
          <Table columns={columns} dataSource={displayExpenseTransactions} rowKey="id" loading={loading} pagination={false} scroll={{ x: 'max-content' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination current={expensePage} pageSize={8} total={expenseTxs.total} onChange={loadExpenseTxs} showSizeChanger={false} />
          </div>
        </Modal>

        {/* Modal แสดงสรุปยอดเงินคงเหลือแบบรายเดือน */}
        <Modal
          title="สรุปยอดเงินคงเหลือรายเดือน"
          open={isBalanceModalVisible}
          onCancel={() => setIsBalanceModalVisible(false)}
          footer={null}
          width={800}
        >
          <Table columns={balanceColumns} dataSource={monthlySummaryData} rowKey="id" pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }} />
        </Modal>

        {/* Modal สำหรับเปลี่ยนรหัสผ่าน */}
        <Modal
          title="เปลี่ยนรหัสผ่าน"
          open={isPasswordModalVisible}
          onCancel={() => setIsPasswordModalVisible(false)}
          footer={null}
          width={400}
        >
          <Form form={passwordForm} layout="vertical" onFinish={onChangePassword}>
            <Form.Item
              name="newPassword"
              label="รหัสผ่านใหม่"
              rules={[{ required: true, message: 'กรุณากรอกรหัสผ่านใหม่!' }]}
            >
              <Input.Password placeholder="ตั้งรหัสผ่านใหม่" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="ยืนยันรหัสผ่านใหม่"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'กรุณายืนยันรหัสผ่านใหม่!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน!'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button type="primary" htmlType="submit" block size="large">
                บันทึกรหัสผ่านใหม่
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {/* Modal สำหรับแก้ไขรายการ */}
        <Modal
          title="แก้ไขรายการ"
          open={isEditModalVisible}
          onCancel={() => setIsEditModalVisible(false)}
          footer={null}
        >
          <Form form={editForm} layout="vertical" onFinish={onEditFinish}>
            <Form.Item name="type" label="ประเภท" rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}>
              <Select placeholder="เลือกรายรับ / รายจ่าย">
                <Option value="INCOME">รายรับ</Option>
                <Option value="EXPENSE">รายจ่าย</Option>
              </Select>
            </Form.Item>
            
            <Form.Item name="amount" label="จำนวนเงิน" rules={[{ required: true, message: 'กรุณากรอกจำนวนเงิน' }]}>
              <InputNumber className="full-width-input" placeholder="0.00" min={0.01} step={10} prefix="฿" />
            </Form.Item>

            <Form.Item name="category" label="หมวดหมู่" rules={[{ required: true, message: 'กรุณาเลือกหมวดหมู่' }]}>
              <Select placeholder="เลือกหมวดหมู่">
                {categories.map(c => (
                  <Option key={c} value={c}>{c}</Option>
                ))}
                <Option value="อื่นๆ">อื่นๆ</Option>
              </Select>
            </Form.Item>

            {editSelectedCategory === 'อื่นๆ' && (
              <Form.Item 
                name="customCategory" 
                label="ระบุหมวดหมู่เพิ่มเติม" 
                rules={[{ required: true, message: 'กรุณาระบุหมวดหมู่ใหม่' }]}
              >
                <Input placeholder="พิมพ์หมวดหมู่ใหม่" />
              </Form.Item>
            )}

            <Form.Item name="description" label="รายละเอียด (ตัวเลือก)">
              <Input placeholder="เช่น ผัดกระเพรา ,ชานม" />
            </Form.Item>

            <Form.Item name="transactionDate" label="วันที่" rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}>
              <DatePicker className="full-width-input" format="DD/MM/YYYY" placeholder="เลือกวันที่" allowClear={false} />
            </Form.Item>

            <Form.Item className="submit-form-item">
              <Button type="primary" htmlType="submit" block size="large">
                บันทึกการแก้ไข
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {/* Modal สำหรับแสดงกราฟวงกลมแบบเลือกเดือนได้ */}
        <Modal
          title="สัดส่วนรายจ่ายตามหมวดหมู่ (รายเดือน)"
          open={isPieChartModalVisible}
          onCancel={() => setIsPieChartModalVisible(false)}
          footer={null}
          width={700}
        >
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 500 }}>เลือกเดือน: </span>
            <DatePicker 
              picker="month" 
              format="MM/YYYY" 
              value={selectedMonthForPie} 
              onChange={(date) => setSelectedMonthForPie(date || dayjs())} 
              allowClear={false}
            />
          </div>
          
          {modalPieData.length > 0 ? (
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modalPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80} // ขยายกราฟให้ใหญ่ขึ้นสำหรับ Modal
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                  >
                    {modalPieData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
              ไม่มีข้อมูลรายจ่ายในเดือนที่เลือก
            </div>
          )}
        </Modal>

        {/* Modal สำหรับแสดงกราฟแท่งแบบ 12 เดือนล่าสุด */}
        <Modal
          title="เปรียบเทียบรายรับ-รายจ่าย (รายปี)"
          open={isBarChartModalVisible}
          onCancel={() => setIsBarChartModalVisible(false)}
          footer={null}
          width={900}
        >
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 500 }}>เลือกปี: </span>
            <DatePicker 
              picker="year" 
              format="YYYY" 
              value={selectedYearForBar} 
              onChange={(date) => setSelectedYearForBar(date || dayjs())} 
              allowClear={false}
              disabledDate={(current: any) => current && (current.year() > dayjs().year() || current.year() < dayjs().year() - 5)} // กำหนดให้เลือกได้แค่ปีปัจจุบัน ย้อนหลังไป 5 ปี
            />
          </div>

          {modalBarData.length > 0 ? (
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modalBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value: any) => `฿${Number(value).toLocaleString()}`} width={80} />
                  <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} cursor={{ fill: '#f5f5f5' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="รายรับ" fill="#52c41a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="รายจ่าย" fill="#ff4d4f" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
              ไม่มีข้อมูล
            </div>
          )}
        </Modal>
      </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default Home;