/**
 * 游戏引擎核心 - 管理游戏循环、时间和系统协调
 */
class GameEngine {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.targetFPS = 60;
        this.frameTime = 1000 / this.targetFPS;
        this.accumulator = 0;
        this.maxDeltaTime = 50; // 最大帧时间，防止螺旋死亡
        
        // 性能监控
        this.frameCount = 0;
        this.fpsCounter = 0;
        this.lastFPSUpdate = 0;
        this.currentFPS = 0;
        
        // 系统管理
        this.systems = new Map();
        this.systemOrder = [];
        
        // 时间管理
        this.timeScale = 1.0;
        this.gameTime = 0;
        this.realTime = 0;
        
        // 绑定方法
        this.gameLoop = this.gameLoop.bind(this);
        
        // 初始化性能监控
        this.initPerformanceMonitoring();
    }

    // 初始化性能监控
    initPerformanceMonitoring() {
        this.performanceData = {
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            memoryUsage: 0
        };
    }

    // 注册系统
    registerSystem(name, system, priority = 0) {
        this.systems.set(name, {
            instance: system,
            priority: priority,
            enabled: true
        });
        
        // 按优先级排序系统
        this.systemOrder = Array.from(this.systems.entries())
            .sort((a, b) => a[1].priority - b[1].priority)
            .map(entry => entry[0]);
        
        console.log(`System '${name}' registered with priority ${priority}`);
    }

    // 获取系统
    getSystem(name) {
        const systemData = this.systems.get(name);
        return systemData ? systemData.instance : null;
    }

    // 启用/禁用系统
    setSystemEnabled(name, enabled) {
        const systemData = this.systems.get(name);
        if (systemData) {
            systemData.enabled = enabled;
        }
    }

    // 启动游戏引擎
    start() {
        if (this.isRunning) {
            console.warn('Game engine is already running');
            return;
        }
        
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.gameTime = 0;
        this.realTime = 0;
        
        console.log('Game engine started');
        gameEventBus.emit(GameEvents.GAME_START);
        
        // 启动游戏循环
        requestAnimationFrame(this.gameLoop);
    }

    // 停止游戏引擎
    stop() {
        this.isRunning = false;
        this.isPaused = false;
        
        console.log('Game engine stopped');
        gameEventBus.emit(GameEvents.GAME_OVER);
    }

    // 暂停游戏
    pause() {
        if (!this.isRunning || this.isPaused) return;
        
        this.isPaused = true;
        console.log('Game paused');
        gameEventBus.emit(GameEvents.GAME_PAUSE);
    }

    // 恢复游戏
    resume() {
        if (!this.isRunning || !this.isPaused) return;
        
        this.isPaused = false;
        this.lastTime = performance.now(); // 重置时间避免大的deltaTime
        console.log('Game resumed');
        gameEventBus.emit(GameEvents.GAME_RESUME);
    }

    // 主游戏循环
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        // 计算时间差
        const rawDeltaTime = currentTime - this.lastTime;
        this.deltaTime = Math.min(rawDeltaTime, this.maxDeltaTime);
        this.lastTime = currentTime;
        
        // 更新真实时间
        this.realTime += this.deltaTime;
        
        // 如果游戏暂停，只更新必要的系统
        if (this.isPaused) {
            this.updatePausedSystems();
            requestAnimationFrame(this.gameLoop);
            return;
        }
        
        // 更新游戏时间
        this.gameTime += this.deltaTime * this.timeScale;
        
        // 性能监控开始
        const frameStartTime = performance.now();
        
        // 固定时间步长更新
        this.accumulator += this.deltaTime;
        
        while (this.accumulator >= this.frameTime) {
            this.fixedUpdate(this.frameTime);
            this.accumulator -= this.frameTime;
        }
        
        // 可变时间步长更新
        const updateStartTime = performance.now();
        this.update(this.deltaTime);
        this.performanceData.updateTime = performance.now() - updateStartTime;
        
        // 渲染
        const renderStartTime = performance.now();
        this.render(this.accumulator / this.frameTime);
        this.performanceData.renderTime = performance.now() - renderStartTime;
        
        // 性能监控结束
        this.performanceData.frameTime = performance.now() - frameStartTime;
        
        // 更新FPS计数器
        this.updateFPSCounter(currentTime);
        
        // 发送帧更新事件
        gameEventBus.emit(GameEvents.FRAME_UPDATE, {
            deltaTime: this.deltaTime,
            gameTime: this.gameTime,
            fps: this.currentFPS
        });
        
        // 继续游戏循环
        requestAnimationFrame(this.gameLoop);
    }

    // 固定时间步长更新（用于物理等需要稳定时间步长的系统）
    fixedUpdate(fixedDeltaTime) {
        this.systemOrder.forEach(systemName => {
            const systemData = this.systems.get(systemName);
            if (systemData && systemData.enabled && systemData.instance.fixedUpdate) {
                try {
                    systemData.instance.fixedUpdate(fixedDeltaTime);
                } catch (error) {
                    console.error(`Error in system '${systemName}' fixedUpdate:`, error);
                }
            }
        });
    }

    // 可变时间步长更新
    update(deltaTime) {
        this.systemOrder.forEach(systemName => {
            const systemData = this.systems.get(systemName);
            if (systemData && systemData.enabled && systemData.instance.update) {
                try {
                    systemData.instance.update(deltaTime);
                } catch (error) {
                    console.error(`Error in system '${systemName}' update:`, error);
                }
            }
        });
    }

    // 渲染
    render(interpolation) {
        this.systemOrder.forEach(systemName => {
            const systemData = this.systems.get(systemName);
            if (systemData && systemData.enabled && systemData.instance.render) {
                try {
                    systemData.instance.render(interpolation);
                } catch (error) {
                    console.error(`Error in system '${systemName}' render:`, error);
                }
            }
        });
    }

    // 更新暂停状态下的系统
    updatePausedSystems() {
        this.systemOrder.forEach(systemName => {
            const systemData = this.systems.get(systemName);
            if (systemData && systemData.enabled && systemData.instance.updatePaused) {
                try {
                    systemData.instance.updatePaused(this.deltaTime);
                } catch (error) {
                    console.error(`Error in system '${systemName}' updatePaused:`, error);
                }
            }
        });
    }

    // 更新FPS计数器
    updateFPSCounter(currentTime) {
        this.frameCount++;
        
        if (currentTime - this.lastFPSUpdate >= 1000) {
            this.currentFPS = Math.round((this.frameCount * 1000) / (currentTime - this.lastFPSUpdate));
            this.frameCount = 0;
            this.lastFPSUpdate = currentTime;
            
            // 更新内存使用情况
            if (performance.memory) {
                this.performanceData.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
            }
        }
    }

    // 设置时间缩放
    setTimeScale(scale) {
        this.timeScale = Math.max(0, scale);
    }

    // 获取时间缩放
    getTimeScale() {
        return this.timeScale;
    }

    // 获取当前FPS
    getFPS() {
        return this.currentFPS;
    }

    // 获取性能数据
    getPerformanceData() {
        return { ...this.performanceData };
    }

    // 获取游戏时间（受时间缩放影响）
    getGameTime() {
        return this.gameTime;
    }

    // 获取真实时间（不受时间缩放影响）
    getRealTime() {
        return this.realTime;
    }

    // 检查游戏是否运行中
    isGameRunning() {
        return this.isRunning && !this.isPaused;
    }

    // 检查游戏是否暂停
    isGamePaused() {
        return this.isPaused;
    }

    // 调试信息
    debug() {
        console.log('Game Engine Debug Info:');
        console.log(`  Running: ${this.isRunning}`);
        console.log(`  Paused: ${this.isPaused}`);
        console.log(`  FPS: ${this.currentFPS}`);
        console.log(`  Time Scale: ${this.timeScale}`);
        console.log(`  Game Time: ${this.gameTime.toFixed(2)}ms`);
        console.log(`  Real Time: ${this.realTime.toFixed(2)}ms`);
        console.log(`  Systems: ${this.systems.size}`);
        console.log('  Performance:');
        console.log(`    Frame Time: ${this.performanceData.frameTime.toFixed(2)}ms`);
        console.log(`    Update Time: ${this.performanceData.updateTime.toFixed(2)}ms`);
        console.log(`    Render Time: ${this.performanceData.renderTime.toFixed(2)}ms`);
        console.log(`    Memory Usage: ${this.performanceData.memoryUsage.toFixed(2)}MB`);
    }
}

