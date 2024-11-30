const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// 中间件：验证管理员token
const verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: '未登录' });
    }

    try {
        const decoded = jwt.verify(token, 'your-secret-key'); // 在生产环境中使用环境变量
        req.adminId = decoded.adminId;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: '登录已过期' });
    }
};

// 管理员登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const [admins] = await req.pool.query(
            'SELECT * FROM admins WHERE username = ? AND password = ?',
            [username, password]
        );

        if (admins.length === 0) {
            return res.json({ success: false, message: '用户名或密码错误' });
        }

        const admin = admins[0];
        const token = jwt.sign(
            { adminId: admin.id },
            'your-secret-key', // 在生产环境中使用环境变量
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });
    } catch (error) {
        console.error('登录失败：', error);
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

// 获取订单列表
router.get('/orders', verifyAdminToken, async (req, res) => {
    try {
        const { status, startDate, endDate, page = 1, pageSize = 10 } = req.query;
        
        let query = 'SELECT * FROM orders';
        const params = [];
        const conditions = [];

        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }

        if (startDate) {
            conditions.push('order_time >= ?');
            params.push(startDate);
        }

        if (endDate) {
            conditions.push('order_time <= ?');
            params.push(endDate);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // 添加分页
        query += ' ORDER BY order_time DESC LIMIT ? OFFSET ?';
        params.push(parseInt(pageSize), (page - 1) * pageSize);

        const [orders] = await req.pool.query(query, params);

        // 获取订单总数
        let countQuery = 'SELECT COUNT(*) as total FROM orders';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        const [countResult] = await req.pool.query(countQuery, params.slice(0, -2));

        // 获取每个订单的商品详情
        for (const order of orders) {
            const [items] = await req.pool.query(
                'SELECT * FROM order_items WHERE order_id = ?',
                [order.id]
            );
            order.items = items;
        }

        res.json({
            success: true,
            orders,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            }
        });
    } catch (error) {
        console.error('获取订单列表失败：', error);
        res.status(500).json({ success: false, message: '获取订单列表失败' });
    }
});

// 更新订单状态
router.put('/orders/:orderNumber/status', verifyAdminToken, async (req, res) => {
    try {
        const { status } = req.body;
        await req.pool.query(
            'UPDATE orders SET status = ? WHERE order_number = ?',
            [status, req.params.orderNumber]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('更新订单状态失败：', error);
        res.status(500).json({ success: false, message: '更新订单状态失败' });
    }
});

// 获取统计数据
router.get('/statistics', verifyAdminToken, async (req, res) => {
    try {
        // 今日订单数
        const [todayOrders] = await req.pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE DATE(order_time) = CURDATE()'
        );

        // 今日营业额
        const [todayRevenue] = await req.pool.query(
            'SELECT SUM(total_amount) as total FROM orders WHERE DATE(order_time) = CURDATE() AND status = "已支付"'
        );

        // 待处理订单数
        const [pendingOrders] = await req.pool.query(
            'SELECT COUNT(*) as count FROM orders WHERE status = "待处理"'
        );

        res.json({
            success: true,
            statistics: {
                todayOrders: todayOrders[0].count,
                todayRevenue: todayRevenue[0].total || 0,
                pendingOrders: pendingOrders[0].count
            }
        });
    } catch (error) {
        console.error('获取统计数据失败：', error);
        res.status(500).json({ success: false, message: '获取统计数据失败' });
    }
});

module.exports = router;
