# AccountBuddy 安全加固指南

## 已完成的修复

### 1. 应用层安全（server/app.ts）

✅ **输入验证增强**
- 描述字段长度限制（100字符）
- 金额范围限制（0.1 - 1,000,000）
- 日期合理性检查（不能是未来超过1年的日期）

✅ **攻击载荷过滤**
- XSS 攻击检测（`<script>`, `javascript:`, `onload=` 等）
- SQL 注入检测（`SELECT`, `INSERT`, `DROP` 等）
- 命令注入检测（`nslookup`, `curl`, `wget` 等）
- 路径遍历检测（`../`, `..\` 等）
- 模板注入检测（`${`, `<%=`, `{{` 等）
- 已知恶意域名检测（`bxss.me` 等）

✅ **速率限制**
- 每分钟最多 30 个请求
- 基于 IP 地址的限流
- 429 状态码返回

✅ **请求体限制**
- 最大 10KB 请求体
- 防止大流量攻击

✅ **安全响应头**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

✅ **输入清理**
- 自动移除 HTML 标签
- 移除控制字符
- 规范化空白字符

## 待完成的网络层安全

### 2. 防火墙配置（推荐）

运行防火墙脚本：
```bash
sudo bash setup-firewall.sh
```

这将：
- 仅允许本地访问 3001 端口
- 阻止外部直接访问
- 保留 SSH、HTTP、HTTPS 端口

### 3. Nginx 反向代理（推荐）

1. 安装 Nginx：
```bash
sudo apt update
sudo apt install nginx
```

2. 复制配置文件：
```bash
sudo cp nginx.conf.example /etc/nginx/conf.d/accountbuddy.conf
# 编辑配置文件，修改 server_name
sudo nano /etc/nginx/conf.d/accountbuddy.conf
```

3. 测试并重载配置：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

4. 配置完成后，外部访问通过 Nginx（80/443 端口），不再直接访问 3001。

### 4. HTTPS 配置（可选但推荐）

使用 Let's Encrypt 免费证书：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. 系统级安全

#### 禁用 root 登录
```bash
sudo nano /etc/ssh/sshd_config
# 设置：PermitRootLogin no
sudo systemctl restart sshd
```

#### 配置 fail2ban（防止暴力破解）
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

#### 定期安全更新
```bash
sudo apt update && sudo apt upgrade -y
```

## 监控建议

### 查看访问日志
```bash
# 如果有 Nginx
sudo tail -f /var/log/nginx/accountbuddy_access.log

# 查看应用日志
journalctl -u accountbuddy -f
```

### 监控异常请求
```bash
# 查找可疑 IP
grep -E "(POST|PUT).*/api/expenses" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr

# 查找大量 429 响应（被限流的请求）
grep " 429 " /var/log/nginx/access.log
```

## 应急响应

如果发现攻击：

1. **立即阻断**：
```bash
# 封禁特定 IP
sudo iptables -A INPUT -s ATTACKER_IP -j DROP
```

2. **查看日志**：
```bash
# 查看最近的 POST 请求
sqlite3 data/accountbuddy.sqlite "SELECT * FROM expenses ORDER BY settled_at DESC LIMIT 20;"
```

3. **清理数据**：
```bash
# 删除可疑记录（金额小于 0.1 的）
sqlite3 data/accountbuddy.sqlite "DELETE FROM expenses WHERE amount < 0.1;"
```

4. **重启服务**：
```bash
npm run restart
```

## 备份建议

定期备份数据库：
```bash
# 创建备份
cp data/accountbuddy.sqlite data/accountbuddy.$(date +%Y%m%d).sqlite

# 或者使用 SQLite 的备份命令
sqlite3 data/accountbuddy.sqlite ".backup data/accountbuddy.backup.sqlite"
```

## 总结

| 层级 | 措施 | 状态 |
|------|------|------|
| 应用层 | 输入验证、攻击检测 | ✅ 已完成 |
| 应用层 | 速率限制 | ✅ 已完成 |
| 应用层 | 安全响应头 | ✅ 已完成 |
| 网络层 | 防火墙（iptables） | ⏳ 待配置 |
| 网络层 | Nginx 反向代理 | ⏳ 待配置 |
| 网络层 | HTTPS | ⏳ 待配置 |
| 系统层 | fail2ban | ⏳ 待配置 |

完成以上配置后，你的 AccountBuddy 将具备企业级的安全防护能力。
