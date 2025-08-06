# 🚀 Railway 部署指南 - Golden Fish Backend

## 📋 **准备工作**

1. ✅ Railway账户: marsnewbie6655@gmail.com (GitHub登录)
2. ✅ Resend API Key: `re_jTuYL41J_DpqE9iM23spyFRds7R8rua9x`
3. ✅ 前端域名: `https://test-ordering-page.vercel.app`

## 🚀 **Railway 部署步骤**

### Step 1: 创建项目和数据库

```bash
# 安装Railway CLI
npm install -g @railway/cli

# 登录Railway (使用GitHub)
railway login

# 进入后端目录
cd goldenfish-backend

# 初始化Railway项目
railway init
# 选择: Create new project
# 项目名: goldenfish-backend

# 添加PostgreSQL
railway add postgresql

# 添加Redis
railway add redis
```

### Step 2: 设置环境变量

```bash
# 设置邮件配置
railway variables:set RESEND_API_KEY=re_jTuYL41J_DpqE9iM23spyFRds7R8rua9x
railway variables:set EMAIL_FROM=onlineorder@ringorderai.com

# 设置CORS
railway variables:set CORS_ORIGINS=https://test-ordering-page.vercel.app

# 设置安全密钥
railway variables:set JWT_SECRET=goldenfish-super-secret-jwt-key-2024

# 设置订单配置
railway variables:set ORDER_NUMBER_PREFIX=GF
railway variables:set DEFAULT_PREP_TIME_DELIVERY=30
railway variables:set DEFAULT_PREP_TIME_COLLECTION=20

# 设置环境
railway variables:set NODE_ENV=production
```

### Step 3: 部署应用

```bash
# 构建项目
npm run build

# 部署到Railway
railway deploy

# 检查部署状态
railway status
```

### Step 4: 运行数据库迁移

```bash
# 在Railway环境中运行迁移
railway run npm run migrate
```

### Step 5: 获取API URL

```bash
# 查看部署的URL
railway domain

# 示例输出: https://goldenfish-backend-production-xxxx.up.railway.app
```

### Step 6: 更新前端API配置

获得Railway URL后，更新前端checkout.html中的API地址：

```javascript
// 在checkout.html中更新这个URL
const apiUrls = [
  'https://your-railway-url.up.railway.app/api/orders', // 替换为实际Railway URL
  'http://localhost:3000/api/orders'  // 开发环境备用
];
```

---

## 🧪 **测试部署**

### 1. 健康检查
```bash
curl https://your-railway-url.up.railway.app/health
```

期望响应:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-06T...",
  "service": "golden-fish-api",
  "version": "1.0.0"
}
```

### 2. 测试订单API
```bash
curl -X POST https://your-railway-url.up.railway.app/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerInfo": {
      "firstName": "Test",
      "lastName": "Customer",
      "email": "test@example.com",
      "phone": "07123456789",
      "accountType": "guest"
    },
    "items": [
      {
        "name": "Test Item",
        "price": 10.00,
        "qty": 1
      }
    ],
    "deliveryType": "collection",
    "paymentMethod": "card",
    "totals": {
      "subtotal": 10.00,
      "deliveryFee": 0,
      "discount": 0,
      "total": 10.00
    }
  }'
```

---

## 📊 **Railway 管理面板**

### 数据库查看
```bash
# 连接PostgreSQL
railway connect postgresql

# 查看订单
SELECT order_number, customer_name, status, total, created_at 
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

# 查看今日统计
SELECT * FROM order_stats_today;
```

### 日志查看
```bash
# 查看实时日志
railway logs --tail

# 查看特定服务日志
railway logs postgresql
railway logs redis
```

---

## 🔧 **故障排除**

### 常见问题

**1. 数据库连接失败**
```bash
# 检查环境变量
railway variables

# 确认DATABASE_URL已设置
echo $DATABASE_URL
```

**2. 邮件发送失败**
- 确认RESEND_API_KEY正确设置
- 检查发送地址onlineorder@ringorderai.com已在Resend验证

**3. CORS错误**
- 确认CORS_ORIGINS包含前端域名
- 检查前端请求URL正确

**4. 内存/CPU问题**
```bash
# 查看资源使用情况
railway metrics

# 升级服务plan（如需要）
railway upgrade
```

### 重新部署
```bash
# 重新构建并部署
npm run build
railway deploy

# 强制重新部署
railway redeploy
```

---

## 🔐 **生产环境安全**

### 1. 更改默认管理员密码
```sql
-- 登录PostgreSQL
railway connect postgresql

-- 更新管理员密码 (bcrypt hash for new password)
UPDATE admin_users 
SET password_hash = '$2a$12$newHashHere...' 
WHERE username = 'admin';
```

### 2. 设置强JWT密钥
```bash
railway variables:set JWT_SECRET=$(openssl rand -base64 64)
```

### 3. 启用HTTPS（Railway自动提供）
- Railway自动提供SSL证书
- 所有API请求通过HTTPS

---

## 📈 **监控和维护**

### 日常监控
```bash
# 每日检查
railway logs --tail | grep ERROR
railway metrics

# 数据库性能
railway connect postgresql
SELECT * FROM pg_stat_activity;
```

### 备份策略
- Railway PostgreSQL自动备份
- 重要配置保存在Git仓库
- 定期导出订单数据

### 更新流程
1. 本地测试更改
2. 提交到Git
3. `railway deploy`
4. 检查health endpoint
5. 测试关键功能

---

## 📞 **支持联系**

- **Railway文档**: https://docs.railway.app
- **项目仓库**: https://github.com/marsnewbie/goldenfish-site
- **Railway项目**: railway.app (登录查看)

---

## ✅ **部署完成检查清单**

- [ ] Railway项目创建成功
- [ ] PostgreSQL和Redis添加并运行
- [ ] 所有环境变量设置完成
- [ ] 应用成功部署
- [ ] 数据库迁移执行成功
- [ ] 健康检查通过
- [ ] 测试订单创建成功
- [ ] 邮件发送正常
- [ ] 前端API地址已更新
- [ ] 生产环境安全设置完成

**🎉 恭喜！你的Golden Fish后端系统已成功部署到Railway！**