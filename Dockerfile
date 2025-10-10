# ---- 第 1 阶段：安装依赖 ----
FROM node:20-slim AS deps

# 启用 corepack 并激活 pnpm（Node20 默认提供 corepack）
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 仅复制依赖清单，提高构建缓存利用率
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（含 devDependencies，后续会裁剪）
RUN pnpm install --frozen-lockfile

# ---- 第 2 阶段：构建项目 (增加详细日志) ----
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
# 复制全部源代码
COPY . .

# 删除敏感文件和目录，保留构建所需的配置文件
RUN rm -rf .git .github docs *.md .gitignore .env.example && \
    find . -name "*.test.js" -delete && \
    find . -name "*.test.ts" -delete && \
    find . -name "*.spec.js" -delete && \
    find . -name "*.spec.ts" -delete && \
    rm -rf scripts/convert-changelog.js 2>/dev/null || true && \
    echo "=== Checking critical config files ===" && \
    ls -la tailwind.config.* postcss.config.* autoprefixer.* 2>/dev/null || echo "Some config files not found" && \
    echo "=== Checking source structure ===" && \
    ls -la src/ && \
    find src -type f -name "*.css" -o -name "*.scss" | head -10

# 在构建阶段也显式设置 DOCKER_ENV，
ENV DOCKER_ENV=true

# 为 Node.js 构建进程增加内存限制，防止因内存不足而构建失败
ENV NODE_OPTIONS="--max-old-space-size=4096"

# ==================== 日志增强部分 ====================
# 1. 打印环境信息，确认基础工具版本
RUN echo "=== Node Version ===" && \
    node -v && \
    echo "=== PNPM Version ===" && \
    pnpm -v && \
    echo "=== TypeScript Version ===" && \
    pnpm exec tsc --version

# 2. 列出当前目录文件，检查代码是否已正确复制
RUN echo "=== Listing Files in /app ===" && \
    ls -la
    
RUN echo "vvv DEBUG: Displaying content of route.ts vvv" && \
    cat src/app/api/proxy/segment/route.ts && \
    echo "^^^ DEBUG: End of content for route.ts ^^^"
    
# 3. 独立运行类型检查，将类型错误和构建错误分离
RUN echo "=== Running TypeScript Type Check ===" && \
    pnpm exec tsc --noEmit --pretty && \
    echo "=== TypeScript Check Completed Successfully ==="

# 4. 执行构建命令，启用Next.js调试输出
RUN echo "=== Starting Next.js Build with Debug Output ===" && \
    pnpm run build:debug && \
    echo "=== Checking build output ===" && \
    ls -la .next/ && \
    ls -la .next/static/ || echo "No static directory found" && \
    ls -la .next/standalone/ || echo "No standalone directory found"
# ======================================================

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-slim AS runner

# 创建非 root 用户 (使用 Debian 兼容的语法)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs --no-create-home --disabled-password nextjs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# 从构建器中复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 从构建器中复制 scripts 目录
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# 从构建器中复制 start.js
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
# 复制 package.json 以便 start.js 内的脚本可以读取版本等元数据
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
# 从构建器中复制 public 和 .next/static 目录，确保静态资源正确复制
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 检查静态资源是否正确复制
RUN echo "=== Checking static assets ===" && \
    ls -la .next/static/ || echo "No static directory" && \
    ls -la public/ || echo "No public directory"


# 添加健康检查脚本
RUN echo '#!/bin/sh' > /tmp/health-check.sh && \
    echo 'curl -f http://localhost:3000/api/health || exit 1' >> /tmp/health-check.sh && \
    chmod +x /tmp/health-check.sh


# 切换到非特权用户
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/tmp/health-check.sh"]
# 使用自定义启动脚本，先预加载配置再启动服务器
CMD ["node", "start.js"]
