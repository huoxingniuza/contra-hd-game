/**
 * 渲染器 - 处理游戏的2D图形渲染
 */
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 渲染设置
        this.width = canvas.width;
        this.height = canvas.height;
        this.pixelRatio = window.devicePixelRatio || 1;
        
        // 摄像机
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            rotation: 0,
            shake: { x: 0, y: 0, intensity: 0, duration: 0 }
        };
        
        // 渲染层
        this.layers = new Map();
        this.layerOrder = [];
        
        // 渲染统计
        this.stats = {
            drawCalls: 0,
            spritesRendered: 0,
            particlesRendered: 0
        };
        
        // 后处理效果
        this.postEffects = [];
        this.effectsEnabled = true;
        
        // 调试渲染
        this.debugMode = false;
        this.debugInfo = {
            showFPS: false,
            showColliders: false,
            showGrid: false
        };
        
        // 初始化渲染器
        this.initialize();
    }

    // 初始化渲染器
    initialize() {
        // 设置高DPI支持
        this.setupHighDPI();
        
        // 设置默认渲染状态
        this.ctx.imageSmoothingEnabled = false; // 像素艺术风格
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // 创建默认渲染层
        this.createLayer('background', -100);
        this.createLayer('game', 0);
        this.createLayer('effects', 50);
        this.createLayer('ui', 100);
        
        console.log('Renderer initialized');
    }

    // 设置高DPI支持
    setupHighDPI() {
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * this.pixelRatio;
        this.canvas.height = rect.height * this.pixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
        
        this.width = rect.width;
        this.height = rect.height;
    }

    // 创建渲染层
    createLayer(name, zIndex) {
        this.layers.set(name, {
            zIndex: zIndex,
            visible: true,
            alpha: 1.0,
            renderQueue: []
        });
        
        // 重新排序层
        this.layerOrder = Array.from(this.layers.entries())
            .sort((a, b) => a[1].zIndex - b[1].zIndex)
            .map(entry => entry[0]);
    }

    // 设置层可见性
    setLayerVisible(name, visible) {
        const layer = this.layers.get(name);
        if (layer) {
            layer.visible = visible;
        }
    }

    // 设置层透明度
    setLayerAlpha(name, alpha) {
        const layer = this.layers.get(name);
        if (layer) {
            layer.alpha = Math.max(0, Math.min(1, alpha));
        }
    }

    // 开始渲染帧
    beginFrame() {
        // 重置统计
        this.stats.drawCalls = 0;
        this.stats.spritesRendered = 0;
        this.stats.particlesRendered = 0;
        
        // 清空渲染队列
        this.layers.forEach(layer => {
            layer.renderQueue = [];
        });
        
        // 更新摄像机震动
        this.updateCameraShake();
    }

    // 结束渲染帧
    endFrame() {
        // 清除画布
        this.clear();
        
        // 应用摄像机变换
        this.ctx.save();
        this.applyCameraTransform();
        
        // 渲染所有层
        this.layerOrder.forEach(layerName => {
            const layer = this.layers.get(layerName);
            if (layer && layer.visible) {
                this.renderLayer(layer);
            }
        });
        
        this.ctx.restore();
        
        // 应用后处理效果
        if (this.effectsEnabled && this.postEffects.length > 0) {
            this.applyPostEffects();
        }
        
        // 渲染调试信息
        if (this.debugMode) {
            this.renderDebugInfo();
        }
    }

    // 清除画布
    clear(color = '#000000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // 应用摄像机变换
    applyCameraTransform() {
        const cam = this.camera;
        
        // 移动到画布中心
        this.ctx.translate(this.width / 2, this.height / 2);
        
        // 应用缩放
        this.ctx.scale(cam.zoom, cam.zoom);
        
        // 应用旋转
        if (cam.rotation !== 0) {
            this.ctx.rotate(cam.rotation);
        }
        
        // 应用摄像机位置和震动
        this.ctx.translate(
            -cam.x + cam.shake.x,
            -cam.y + cam.shake.y
        );
    }

    // 渲染层
    renderLayer(layer) {
        if (layer.alpha < 1.0) {
            this.ctx.save();
            this.ctx.globalAlpha = layer.alpha;
        }
        
        layer.renderQueue.forEach(renderCommand => {
            this.executeRenderCommand(renderCommand);
        });
        
        if (layer.alpha < 1.0) {
            this.ctx.restore();
        }
    }

    // 执行渲染命令
    executeRenderCommand(command) {
        this.stats.drawCalls++;
        
        switch (command.type) {
            case 'sprite':
                this.renderSprite(command);
                break;
            case 'rect':
                this.renderRect(command);
                break;
            case 'circle':
                this.renderCircle(command);
                break;
            case 'line':
                this.renderLine(command);
                break;
            case 'text':
                this.renderText(command);
                break;
            case 'particle':
                this.renderParticle(command);
                break;
            default:
                console.warn(`Unknown render command type: ${command.type}`);
        }
    }

    // 添加精灵到渲染队列
    drawSprite(image, x, y, width, height, layer = 'game', options = {}) {
        const layerObj = this.layers.get(layer);
        if (!layerObj) return;
        
        layerObj.renderQueue.push({
            type: 'sprite',
            image: image,
            x: x,
            y: y,
            width: width,
            height: height,
            sourceX: options.sourceX || 0,
            sourceY: options.sourceY || 0,
            sourceWidth: options.sourceWidth || image.width,
            sourceHeight: options.sourceHeight || image.height,
            rotation: options.rotation || 0,
            scaleX: options.scaleX || 1,
            scaleY: options.scaleY || 1,
            alpha: options.alpha || 1,
            flipX: options.flipX || false,
            flipY: options.flipY || false,
            tint: options.tint || null
        });
    }

    // 渲染精灵
    renderSprite(command) {
        this.ctx.save();
        
        // 移动到精灵位置
        this.ctx.translate(command.x + command.width / 2, command.y + command.height / 2);
        
        // 应用变换
        if (command.rotation !== 0) {
            this.ctx.rotate(command.rotation);
        }
        
        this.ctx.scale(command.scaleX, command.scaleY);
        
        if (command.flipX) {
            this.ctx.scale(-1, 1);
        }
        
        if (command.flipY) {
            this.ctx.scale(1, -1);
        }
        
        if (command.alpha !== 1) {
            this.ctx.globalAlpha = command.alpha;
        }
        
        // 应用色调
        if (command.tint) {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = command.tint;
        }
        
        // 绘制精灵
        this.ctx.drawImage(
            command.image,
            command.sourceX, command.sourceY,
            command.sourceWidth, command.sourceHeight,
            -command.width / 2, -command.height / 2,
            command.width, command.height
        );
        
        this.ctx.restore();
        this.stats.spritesRendered++;
    }

    // 添加矩形到渲染队列
    drawRect(x, y, width, height, color, layer = 'game', options = {}) {
        const layerObj = this.layers.get(layer);
        if (!layerObj) return;
        
        layerObj.renderQueue.push({
            type: 'rect',
            x: x,
            y: y,
            width: width,
            height: height,
            color: color,
            filled: options.filled !== false,
            lineWidth: options.lineWidth || 1,
            alpha: options.alpha || 1
        });
    }

    // 渲染矩形
    renderRect(command) {
        this.ctx.save();
        
        if (command.alpha !== 1) {
            this.ctx.globalAlpha = command.alpha;
        }
        
        if (command.filled) {
            this.ctx.fillStyle = command.color;
            this.ctx.fillRect(command.x, command.y, command.width, command.height);
        } else {
            this.ctx.strokeStyle = command.color;
            this.ctx.lineWidth = command.lineWidth;
            this.ctx.strokeRect(command.x, command.y, command.width, command.height);
        }
        
        this.ctx.restore();
    }

    // 添加圆形到渲染队列
    drawCircle(x, y, radius, color, layer = 'game', options = {}) {
        const layerObj = this.layers.get(layer);
        if (!layerObj) return;
        
        layerObj.renderQueue.push({
            type: 'circle',
            x: x,
            y: y,
            radius: radius,
            color: color,
            filled: options.filled !== false,
            lineWidth: options.lineWidth || 1,
            alpha: options.alpha || 1
        });
    }

    // 渲染圆形
    renderCircle(command) {
        this.ctx.save();
        
        if (command.alpha !== 1) {
            this.ctx.globalAlpha = command.alpha;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2);
        
        if (command.filled) {
            this.ctx.fillStyle = command.color;
            this.ctx.fill();
        } else {
            this.ctx.strokeStyle = command.color;
            this.ctx.lineWidth = command.lineWidth;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    // 添加文本到渲染队列
    drawText(text, x, y, font, color, layer = 'ui', options = {}) {
        const layerObj = this.layers.get(layer);
        if (!layerObj) return;
        
        layerObj.renderQueue.push({
            type: 'text',
            text: text,
            x: x,
            y: y,
            font: font,
            color: color,
            align: options.align || 'left',
            baseline: options.baseline || 'top',
            alpha: options.alpha || 1,
            stroke: options.stroke || false,
            strokeColor: options.strokeColor || '#000000',
            strokeWidth: options.strokeWidth || 1
        });
    }

    // 渲染文本
    renderText(command) {
        this.ctx.save();
        
        this.ctx.font = command.font;
        this.ctx.textAlign = command.align;
        this.ctx.textBaseline = command.baseline;
        
        if (command.alpha !== 1) {
            this.ctx.globalAlpha = command.alpha;
        }
        
        if (command.stroke) {
            this.ctx.strokeStyle = command.strokeColor;
            this.ctx.lineWidth = command.strokeWidth;
            this.ctx.strokeText(command.text, command.x, command.y);
        }
        
        this.ctx.fillStyle = command.color;
        this.ctx.fillText(command.text, command.x, command.y);
        
        this.ctx.restore();
    }

    // 设置摄像机位置
    setCameraPosition(x, y) {
        this.camera.x = x;
        this.camera.y = y;
    }

    // 设置摄像机缩放
    setCameraZoom(zoom) {
        this.camera.zoom = Math.max(0.1, zoom);
    }

    // 摄像机震动
    shakeCamera(intensity, duration) {
        this.camera.shake.intensity = intensity;
        this.camera.shake.duration = duration;
    }

    // 更新摄像机震动
    updateCameraShake() {
        if (this.camera.shake.duration > 0) {
            this.camera.shake.duration--;
            
            const intensity = this.camera.shake.intensity;
            this.camera.shake.x = (Math.random() - 0.5) * intensity;
            this.camera.shake.y = (Math.random() - 0.5) * intensity;
        } else {
            this.camera.shake.x = 0;
            this.camera.shake.y = 0;
        }
    }

    // 世界坐标转屏幕坐标
    worldToScreen(worldX, worldY) {
        const cam = this.camera;
        const screenX = (worldX - cam.x) * cam.zoom + this.width / 2;
        const screenY = (worldY - cam.y) * cam.zoom + this.height / 2;
        return { x: screenX, y: screenY };
    }

    // 屏幕坐标转世界坐标
    screenToWorld(screenX, screenY) {
        const cam = this.camera;
        const worldX = (screenX - this.width / 2) / cam.zoom + cam.x;
        const worldY = (screenY - this.height / 2) / cam.zoom + cam.y;
        return { x: worldX, y: worldY };
    }

    // 检查对象是否在视野内
    isInView(x, y, width, height) {
        const cam = this.camera;
        const margin = 100; // 额外边距
        
        const left = cam.x - this.width / (2 * cam.zoom) - margin;
        const right = cam.x + this.width / (2 * cam.zoom) + margin;
        const top = cam.y - this.height / (2 * cam.zoom) - margin;
        const bottom = cam.y + this.height / (2 * cam.zoom) + margin;
        
        return !(x + width < left || x > right || y + height < top || y > bottom);
    }

    // 添加后处理效果
    addPostEffect(effect) {
        this.postEffects.push(effect);
    }

    // 移除后处理效果
    removePostEffect(effect) {
        const index = this.postEffects.indexOf(effect);
        if (index > -1) {
            this.postEffects.splice(index, 1);
        }
    }

    // 应用后处理效果
    applyPostEffects() {
        this.postEffects.forEach(effect => {
            if (effect.enabled) {
                effect.apply(this.ctx, this.width, this.height);
            }
        });
    }

    // 渲染调试信息
    renderDebugInfo() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置变换
        
        if (this.debugInfo.showFPS) {
            this.drawText(`FPS: ${gameEngine.getFPS()}`, 10, 10, '16px Arial', '#00ff00', 'ui');
            this.drawText(`Draw Calls: ${this.stats.drawCalls}`, 10, 30, '16px Arial', '#00ff00', 'ui');
            this.drawText(`Sprites: ${this.stats.spritesRendered}`, 10, 50, '16px Arial', '#00ff00', 'ui');
        }
        
        this.ctx.restore();
    }

    // 设置调试模式
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    // 设置调试选项
    setDebugOption(option, enabled) {
        if (this.debugInfo.hasOwnProperty(option)) {
            this.debugInfo[option] = enabled;
        }
    }

    // 获取渲染统计
    getStats() {
        return { ...this.stats };
    }

    // 调试信息
    debug() {
        console.log('Renderer Debug Info:');
        console.log(`  Canvas Size: ${this.width}x${this.height}`);
        console.log(`  Pixel Ratio: ${this.pixelRatio}`);
        console.log(`  Camera: (${this.camera.x.toFixed(2)}, ${this.camera.y.toFixed(2)}) zoom=${this.camera.zoom}`);
        console.log(`  Layers: ${this.layers.size}`);
        console.log(`  Post Effects: ${this.postEffects.length}`);
        console.log(`  Debug Mode: ${this.debugMode}`);
        console.log('  Stats:', this.stats);
    }
}

