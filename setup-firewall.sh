#!/bin/bash
# AccountBuddy 防火墙配置脚本
# 用于限制对 3001 端口的访问

echo "配置防火墙规则..."

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 sudo 运行此脚本"
    exit 1
fi

# 清除现有规则（谨慎使用）
# iptables -F

# 允许本地回环接口
iptables -A INPUT -i lo -j ACCEPT

# 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 允许 SSH（防止被锁在外面）
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 允许 HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 允许本地访问 3001 端口（仅本机）
iptables -A INPUT -p tcp --dport 3001 -s 127.0.0.1 -j ACCEPT

# 拒绝其他所有对 3001 端口的访问
iptables -A INPUT -p tcp --dport 3001 -j DROP

# 允许其他必要端口（根据需要修改）
# iptables -A INPUT -p tcp --dport YOUR_PORT -j ACCEPT

# 默认策略：丢弃其他所有入站连接
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

echo "防火墙规则已应用"
echo ""
echo "当前规则："
iptables -L -n | grep 3001
