const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const config = require('./config');
const adminRoutes = require('./adminRoutes');
const path = require('path');

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use('/', express.static(path.join(__dirname, '..'))); // 将根目录设置为静态文件目录

// 添加路由处理首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 添加路由处理订单页面
app.get('/order.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'order.html'));
});

// 添加路由处理支付页面
app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'payment.html'));
});

// 添加路由处理订单详情页面
app.get('/order-detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'order-detail.html'));
});

// 创建数据库连接池
const pool = mysql.createPool({
    ...config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// 添加pool到请求对象
app.use((req, res, next) => {
    req.pool = pool;
    // 添加请求日志
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// 测试数据库连接
async function testConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('数据库连接成功！');
    } catch (error) {
        console.error('数据库连接失败：', error);
    }
}

// API路由
// 创建订单
app.post('/api/orders', async (req, res) => {
    try {
        const { dining_method, address, order_time, phone, total_amount, items } = req.body;
        
        // 生成订单号
        const now = new Date();
        const orderNumber = 'WW' + now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(Math.floor(Math.random() * 1000)).padStart(3, '0');

        console.log('收到订单请求:', { orderNumber, dining_method, address, total_amount });
        
        // 开始事务
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 创建主订单
            const [orderResult] = await connection.query(
                `INSERT INTO orders 
                (order_number, dining_method, address, order_time, phone, total_amount, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderNumber, dining_method, address, order_time, phone, total_amount, '待处理']
            );

            const orderId = orderResult.insertId;

            // 创建订单商品
            for (const item of items) {
                await connection.query(
                    `INSERT INTO order_items 
                    (order_id, item_name, quantity, price, subtotal) 
                    VALUES (?, ?, ?, ?, ?)`,
                    [orderId, item.item_name, item.quantity, item.price, item.quantity * item.price]
                );
            }

            // 提交事务
            await connection.commit();
            console.log('订单创建成功:', orderNumber);
            
            res.json({
                success: true,
                message: '订单创建成功',
                orderNumber: orderNumber
            });
        } catch (error) {
            // 如果出错，回滚事务
            await connection.rollback();
            console.error('订单创建失败:', error);
            res.status(500).json({
                success: false,
                message: '订单创建失败: ' + error.message
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('处理订单请求失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 获取订单详情
app.get('/api/orders/:orderNumber', async (req, res) => {
    try {
        const { orderNumber } = req.params;
        console.log('查询订单号:', orderNumber); // 添加日志
        
        // 修改查询语句，处理订单号为空的情况
        const query = orderNumber 
            ? `SELECT * FROM orders WHERE order_number = ?`
            : `SELECT * FROM orders WHERE id = ?`;
            
        const [orders] = await pool.query(query, [orderNumber]);
        console.log('查询结果:', orders); // 添加日志

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        const order = orders[0];
        const [items] = await pool.query(
            `SELECT * FROM order_items WHERE order_id = ?`,
            [order.id]
        );
        console.log('订单项目:', items); // 添加日志

        res.json({
            success: true,
            order: {
                ...order,
                items
            }
        });
    } catch (error) {
        console.error('获取订单详情失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

// 更新订单状态
app.put('/api/orders/:orderNumber/status', async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { status } = req.body;

        const [result] = await pool.query(
            'UPDATE orders SET status = ? WHERE order_number = ?',
            [status, orderNumber]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: '订单不存在'
            });
        }

        res.json({ 
            success: true,
            message: '订单状态更新成功'
        });
    } catch (error) {
        console.error('更新订单状态失败：', error);
        res.status(500).json({ 
            success: false, 
            message: '更新订单状态失败' 
        });
    }
});

// 管理员路由
app.use('/api/admin', adminRoutes);

// 启动服务器
const PORT = config.port || 3001;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    // 测试数据库连接
    testConnection();
});
