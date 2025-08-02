/**
 * 输入管理器 - 处理键盘、鼠标、触摸等输入
 */
class InputManager {
    constructor() {
        // 键盘状态
        this.keys = new Map();
        this.keysPressed = new Set();
        this.keysReleased = new Set();
        
        // 鼠标状态
        this.mouse = {
            x: 0,
            y: 0,
            buttons: new Map(),
            buttonsPressed: new Set(),
            buttonsReleased: new Set(),
            wheel: 0
        };
        
        // 触摸状态
        this.touches = new Map();
        this.touchesStarted = new Set();
        this.touchesEnded = new Set();
        
        // 虚拟按键状态（用于移动端虚拟控制器）
        this.virtualKeys = new Map();
        
        // 输入映射
        this.keyMappings = new Map();
        this.setupDefaultKeyMappings();
        
        // 事件监听器
        this.setupEventListeners();
        
        // 移动端检测
        this.isMobile = this.detectMobile();
        
        // 输入缓冲
        this.inputBuffer = [];
        this.bufferSize = 10;
        this.bufferTime = 100; // ms
    }

    // 设置默认按键映射
    setupDefaultKeyMappings() {
        this.keyMappings.set('move_left', ['ArrowLeft', 'KeyA']);
        this.keyMappings.set('move_right', ['ArrowRight', 'KeyD']);
        this.keyMappings.set('move_up', ['ArrowUp', 'KeyW']);
        this.keyMappings.set('move_down', ['ArrowDown', 'KeyS']);
        this.keyMappings.set('jump', ['Space']);
        this.keyMappings.set('shoot', ['KeyZ', 'KeyJ']);
        this.keyMappings.set('weapon_switch', ['KeyX', 'KeyK']);
        this.keyMappings.set('pause', ['KeyP', 'Escape']);
    }

    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // 设置事件监听器
    setupEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // 鼠标事件
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        // 触摸事件
        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        
        // 防止上下文菜单
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // 窗口失焦时清除所有输入状态
        window.addEventListener('blur', this.clearAllInputs.bind(this));
        
        // 设置虚拟控制器事件（移动端）
        if (this.isMobile) {
            this.setupVirtualControls();
        }
    }

    // 键盘按下事件
    onKeyDown(event) {
        const key = event.code;
        
        if (!this.keys.get(key)) {
            this.keys.set(key, true);
            this.keysPressed.add(key);
            this.addToInputBuffer('keydown', key, performance.now());
            
            gameEventBus.emit(GameEvents.INPUT_KEY_DOWN, {
                key: key,
                code: event.code,
                keyCode: event.keyCode
            });
        }
        
        // 防止默认行为（如空格键滚动页面）
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            event.preventDefault();
        }
    }

    // 键盘释放事件
    onKeyUp(event) {
        const key = event.code;
        
        this.keys.set(key, false);
        this.keysReleased.add(key);
        this.addToInputBuffer('keyup', key, performance.now());
        
        gameEventBus.emit(GameEvents.INPUT_KEY_UP, {
            key: key,
            code: event.code,
            keyCode: event.keyCode
        });
    }

    // 鼠标按下事件
    onMouseDown(event) {
        const button = event.button;
        
        this.mouse.buttons.set(button, true);
        this.mouse.buttonsPressed.add(button);
        this.addToInputBuffer('mousedown', button, performance.now());
        
        event.preventDefault();
    }

    // 鼠标释放事件
    onMouseUp(event) {
        const button = event.button;
        
        this.mouse.buttons.set(button, false);
        this.mouse.buttonsReleased.add(button);
        this.addToInputBuffer('mouseup', button, performance.now());
    }

    // 鼠标移动事件
    onMouseMove(event) {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
    }

    // 鼠标滚轮事件
    onMouseWheel(event) {
        this.mouse.wheel = event.deltaY;
        event.preventDefault();
    }

    // 触摸开始事件
    onTouchStart(event) {
        for (let touch of event.changedTouches) {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: performance.now()
            });
            this.touchesStarted.add(touch.identifier);
        }
        
        gameEventBus.emit(GameEvents.INPUT_TOUCH_START, {
            touches: Array.from(event.changedTouches)
        });
        
        event.preventDefault();
    }

    // 触摸结束事件
    onTouchEnd(event) {
        for (let touch of event.changedTouches) {
            this.touches.delete(touch.identifier);
            this.touchesEnded.add(touch.identifier);
        }
        
        gameEventBus.emit(GameEvents.INPUT_TOUCH_END, {
            touches: Array.from(event.changedTouches)
        });
        
        event.preventDefault();
    }

    // 触摸移动事件
    onTouchMove(event) {
        for (let touch of event.changedTouches) {
            if (this.touches.has(touch.identifier)) {
                const touchData = this.touches.get(touch.identifier);
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
            }
        }
        
        event.preventDefault();
    }

    // 设置虚拟控制器
    setupVirtualControls() {
        const virtualButtons = document.querySelectorAll('[data-key]');
        
        virtualButtons.forEach(button => {
            const key = button.getAttribute('data-key');
            
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.setVirtualKey(key, true);
                button.classList.add('active');
            });
            
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.setVirtualKey(key, false);
                button.classList.remove('active');
            });
            
            // 防止触摸离开按钮时按键卡住
            button.addEventListener('touchleave', (e) => {
                this.setVirtualKey(key, false);
                button.classList.remove('active');
            });
        });
    }

    // 设置虚拟按键状态
    setVirtualKey(key, pressed) {
        const wasPressed = this.virtualKeys.get(key) || false;
        this.virtualKeys.set(key, pressed);
        
        if (pressed && !wasPressed) {
            this.keysPressed.add(key);
            gameEventBus.emit(GameEvents.INPUT_KEY_DOWN, { key: key });
        } else if (!pressed && wasPressed) {
            this.keysReleased.add(key);
            gameEventBus.emit(GameEvents.INPUT_KEY_UP, { key: key });
        }
    }

    // 添加到输入缓冲
    addToInputBuffer(type, input, time) {
        this.inputBuffer.push({ type, input, time });
        
        // 保持缓冲区大小
        if (this.inputBuffer.length > this.bufferSize) {
            this.inputBuffer.shift();
        }
        
        // 清理过期的输入
        const currentTime = performance.now();
        this.inputBuffer = this.inputBuffer.filter(
            item => currentTime - item.time <= this.bufferTime
        );
    }

    // 检查按键是否按下
    isKeyDown(key) {
        return this.keys.get(key) || this.virtualKeys.get(key) || false;
    }

    // 检查按键是否刚按下
    isKeyPressed(key) {
        return this.keysPressed.has(key);
    }

    // 检查按键是否刚释放
    isKeyReleased(key) {
        return this.keysReleased.has(key);
    }

    // 检查动作是否激活（通过映射）
    isActionDown(action) {
        const keys = this.keyMappings.get(action) || [];
        return keys.some(key => this.isKeyDown(key));
    }

    // 检查动作是否刚激活
    isActionPressed(action) {
        const keys = this.keyMappings.get(action) || [];
        return keys.some(key => this.isKeyPressed(key));
    }

    // 检查动作是否刚释放
    isActionReleased(action) {
        const keys = this.keyMappings.get(action) || [];
        return keys.some(key => this.isKeyReleased(key));
    }

    // 获取输入轴值（-1到1）
    getAxis(negativeAction, positiveAction) {
        let value = 0;
        if (this.isActionDown(negativeAction)) value -= 1;
        if (this.isActionDown(positiveAction)) value += 1;
        return value;
    }

    // 获取鼠标位置
    getMousePosition() {
        return { x: this.mouse.x, y: this.mouse.y };
    }

    // 检查鼠标按钮是否按下
    isMouseButtonDown(button) {
        return this.mouse.buttons.get(button) || false;
    }

    // 检查鼠标按钮是否刚按下
    isMouseButtonPressed(button) {
        return this.mouse.buttonsPressed.has(button);
    }

    // 获取鼠标滚轮值
    getMouseWheel() {
        return this.mouse.wheel;
    }

    // 获取触摸信息
    getTouches() {
        return Array.from(this.touches.values());
    }

    // 检查是否有触摸输入
    hasTouches() {
        return this.touches.size > 0;
    }

    // 设置按键映射
    setKeyMapping(action, keys) {
        this.keyMappings.set(action, Array.isArray(keys) ? keys : [keys]);
    }

    // 获取按键映射
    getKeyMapping(action) {
        return this.keyMappings.get(action) || [];
    }

    // 清除所有输入状态
    clearAllInputs() {
        this.keys.clear();
        this.keysPressed.clear();
        this.keysReleased.clear();
        this.virtualKeys.clear();
        
        this.mouse.buttons.clear();
        this.mouse.buttonsPressed.clear();
        this.mouse.buttonsReleased.clear();
        this.mouse.wheel = 0;
        
        this.touches.clear();
        this.touchesStarted.clear();
        this.touchesEnded.clear();
    }

    // 更新输入状态（每帧调用）
    update() {
        // 清除本帧的按键事件
        this.keysPressed.clear();
        this.keysReleased.clear();
        
        this.mouse.buttonsPressed.clear();
        this.mouse.buttonsReleased.clear();
        this.mouse.wheel = 0;
        
        this.touchesStarted.clear();
        this.touchesEnded.clear();
    }

    // 检查是否为移动设备
    isMobileDevice() {
        return this.isMobile;
    }

    // 获取输入缓冲
    getInputBuffer() {
        return [...this.inputBuffer];
    }

    // 调试信息
    debug() {
        console.log('Input Manager Debug Info:');
        console.log(`  Active Keys: ${Array.from(this.keys.entries()).filter(([k, v]) => v).map(([k]) => k).join(', ')}`);
        console.log(`  Mouse Position: (${this.mouse.x}, ${this.mouse.y})`);
        console.log(`  Active Touches: ${this.touches.size}`);
        console.log(`  Is Mobile: ${this.isMobile}`);
        console.log(`  Input Buffer Size: ${this.inputBuffer.length}`);
    }
}

