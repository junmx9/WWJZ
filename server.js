const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 数据库连接
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('数据库连接失败:', err);
        return;
    }
    console.log('数据库连接成功');
});

// API路由
// 登录
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const token = jwt.sign(
            { id: user.id, role: user.role },
            'your-secret-key', // 请更改为安全的密钥
            { expiresIn: '1d' }
        );
        
        res.json({ token, role: user.role });
    });
});

// 获取订单列表
app.get('/api/orders', (req, res) => {
    const query = `
        SELECT o.*, u.username 
        FROM orders o 
        LEFT JOIN users u ON o.user_id = u.id 
        ORDER BY o.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        res.json(results);
    });
});

// 获取单个订单详情
app.get('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    
    const query = `
        SELECT o.*, oi.quantity, oi.price as item_price, d.name as dish_name
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN dishes d ON oi.dish_id = d.id
        WHERE o.id = ?
    `;
    
    db.query(query, [orderId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: '订单不存在' });
        }
        
        // 重组数据结构
        const order = {
            ...results[0],
            items: results.map(item => ({
                name: item.dish_name,
                quantity: item.quantity,
                price: item.item_price
            }))
        };
        
        delete order.dish_name;
        delete order.quantity;
        delete order.item_price;
        
        res.json(order);
    });
});

// 更新订单状态
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const query = 'UPDATE orders SET status = ? WHERE id = ?';
    db.query(query, [status, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        res.json({ message: '订单状态已更新' });
    });
});

// 获取菜品列表
app.get('/api/dishes', (req, res) => {
    const query = 'SELECT * FROM dishes ORDER BY category, name';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        res.json(results);
    });
});

// 添加菜品
app.post('/api/dishes', (req, res) => {
    const { name, price, description, category, image_url } = req.body;
    
    const query = 'INSERT INTO dishes (name, price, description, category, image_url) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name, price, description, category, image_url], (err, result) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        res.json({ id: result.insertId, message: '菜品添加成功' });
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
