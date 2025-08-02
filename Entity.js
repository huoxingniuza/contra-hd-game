/**
 * 游戏实体基类 - 所有游戏对象的基础类
 */
class Entity {
    constructor(x = 0, y = 0, options = {}) {
        // 唯一标识符
        this.id = Math.random().toString(36).substr(2, 9);
        
        // 基本属性
        this.position = new Vector2(x, y);
        this.velocity = new Vector2();
        this.acceleration = new Vector2();
        this.rotation = 0;
        this.scale = new Vector2(1, 1);
        
        // 尺寸
        this.width = options.width || 32;
        this.height = options.height || 32;
        
        // 状态
        this.active = true;
        this.visible = true;
        this.destroyed = false;
        
        // 生命周期
        this.age = 0;
        this.maxAge = options.maxAge || Infinity;
        
        // 渲染属性
        this.sprite = options.sprite || null;
        this.color = options.color || '#ffffff';
        this.alpha = options.alpha || 1;
        this.layer = options.layer || 'game';
        this.zIndex = options.zIndex || 0;
        
        // 物理属性
        this.physicsBody = null;
        this.usePhysics = options.usePhysics || false;
        
        // 碰撞属性
        this.collider = {
            enabled: options.collider !== false,
            type: options.colliderType || 'rect',
            width: options.colliderWidth || this.width,
            height: options.colliderHeight || this.height,
            radius: options.colliderRadius || Math.max(this.width, this.height) / 2,
            offset: new Vector2(options.colliderOffsetX || 0, options.colliderOffsetY || 0),
            isTrigger: options.isTrigger || false
        };
        
        // 组件系统
        this.components = new Map();
        
        // 标签系统
        this.tags = new Set(options.tags || []);
        
        // 用户数据
        this.userData = options.userData || {};
        
        // 事件处理
        this.eventHandlers = new Map();
        
        // 初始化
        this.initialize(options);
    }

    // 初始化（子类重写）
    initialize(options) {
        // 子类实现具体初始化逻辑
    }

    // 更新
    update(deltaTime) {
        if (!this.active || this.destroyed) return;
        
        // 更新年龄
        this.age += deltaTime;
        
        // 检查生命周期
        if (this.age >= this.maxAge) {
            this.destroy();
            return;
        }
        
        // 更新组件
        this.updateComponents(deltaTime);
        
        // 更新物理
        this.updatePhysics(deltaTime);
        
        // 子类更新逻辑
        this.onUpdate(deltaTime);
        
        // 更新位置
        this.updatePosition(deltaTime);
    }

    // 子类更新逻辑（子类重写）
    onUpdate(deltaTime) {
        // 子类实现具体更新逻辑
    }

    // 更新组件
    updateComponents(deltaTime) {
        this.components.forEach(component => {
            if (component.enabled && component.update) {
                component.update(deltaTime);
            }
        });
    }

    // 更新物理
    updatePhysics(deltaTime) {
        if (this.physicsBody) {
            // 同步物理体位置到实体
            this.position.copy(this.physicsBody.position);
            this.rotation = this.physicsBody.rotation;
        } else if (!this.usePhysics) {
            // 简单的运动学更新
            this.velocity.add(Vector2.multiply(this.acceleration, deltaTime));
            this.position.add(Vector2.multiply(this.velocity, deltaTime));
        }
    }

    // 更新位置
    updatePosition(deltaTime) {
        // 如果有物理体，同步位置
        if (this.physicsBody) {
            this.physicsBody.position.copy(this.position);
        }
    }

    // 渲染
    render(renderer) {
        if (!this.visible || this.destroyed) return;
        
        // 视锥剔除
        if (!renderer.isInView(this.position.x - this.width/2, this.position.y - this.height/2, this.width, this.height)) {
            return;
        }
        
        // 渲染精灵或基本形状
        if (this.sprite) {
            this.renderSprite(renderer);
        } else {
            this.renderShape(renderer);
        }
        
        // 渲染组件
        this.renderComponents(renderer);
        
        // 子类渲染逻辑
        this.onRender(renderer);
        
        // 调试渲染
        if (renderer.debugMode) {
            this.renderDebug(renderer);
        }
    }

    // 渲染精灵
    renderSprite(renderer) {
        const options = {
            rotation: this.rotation,
            scaleX: this.scale.x,
            scaleY: this.scale.y,
            alpha: this.alpha
        };
        
        renderer.drawSprite(
            this.sprite,
            this.position.x - this.width / 2,
            this.position.y - this.height / 2,
            this.width,
            this.height,
            this.layer,
            options
        );
    }

    // 渲染基本形状
    renderShape(renderer) {
        if (this.collider.type === 'circle') {
            renderer.drawCircle(
                this.position.x,
                this.position.y,
                this.collider.radius,
                this.color,
                this.layer,
                { alpha: this.alpha }
            );
        } else {
            renderer.drawRect(
                this.position.x - this.width / 2,
                this.position.y - this.height / 2,
                this.width,
                this.height,
                this.color,
                this.layer,
                { alpha: this.alpha }
            );
        }
    }

    // 渲染组件
    renderComponents(renderer) {
        this.components.forEach(component => {
            if (component.enabled && component.render) {
                component.render(renderer);
            }
        });
    }

    // 子类渲染逻辑（子类重写）
    onRender(renderer) {
        // 子类实现具体渲染逻辑
    }

    // 调试渲染
    renderDebug(renderer) {
        if (this.collider.enabled) {
            const colliderPos = Vector2.add(this.position, this.collider.offset);
            
            if (this.collider.type === 'circle') {
                renderer.drawCircle(
                    colliderPos.x,
                    colliderPos.y,
                    this.collider.radius,
                    this.collider.isTrigger ? '#00ff00' : '#ff0000',
                    'ui',
                    { filled: false, alpha: 0.5 }
                );
            } else {
                renderer.drawRect(
                    colliderPos.x - this.collider.width / 2,
                    colliderPos.y - this.collider.height / 2,
                    this.collider.width,
                    this.collider.height,
                    this.collider.isTrigger ? '#00ff00' : '#ff0000',
                    'ui',
                    { filled: false, alpha: 0.5 }
                );
            }
        }
    }

    // 添加组件
    addComponent(name, component) {
        component.entity = this;
        this.components.set(name, component);
        
        if (component.initialize) {
            component.initialize();
        }
        
        return component;
    }

    // 获取组件
    getComponent(name) {
        return this.components.get(name);
    }

    // 移除组件
    removeComponent(name) {
        const component = this.components.get(name);
        if (component) {
            if (component.destroy) {
                component.destroy();
            }
            this.components.delete(name);
        }
    }

    // 检查是否有组件
    hasComponent(name) {
        return this.components.has(name);
    }

    // 添加标签
    addTag(tag) {
        this.tags.add(tag);
    }

    // 移除标签
    removeTag(tag) {
        this.tags.delete(tag);
    }

    // 检查是否有标签
    hasTag(tag) {
        return this.tags.has(tag);
    }

    // 设置物理体
    setPhysicsBody(physicsEngine, options = {}) {
        if (this.physicsBody) {
            physicsEngine.removeBody(this.physicsBody);
        }
        
        const bodyOptions = {
            position: this.position.clone(),
            rotation: this.rotation,
            shape: this.collider.type === 'circle' 
                ? { type: 'circle', radius: this.collider.radius }
                : { type: 'rect', width: this.collider.width, height: this.collider.height },
            userData: { entity: this, type: this.constructor.name.toLowerCase() },
            ...options
        };
        
        this.physicsBody = physicsEngine.createBody(bodyOptions);
        this.usePhysics = true;
        
        return this.physicsBody;
    }

    // 移除物理体
    removePhysicsBody(physicsEngine) {
        if (this.physicsBody) {
            physicsEngine.removeBody(this.physicsBody);
            this.physicsBody = null;
            this.usePhysics = false;
        }
    }

    // 碰撞检测
    checkCollision(other) {
        if (!this.collider.enabled || !other.collider.enabled) {
            return false;
        }
        
        const thisPos = Vector2.add(this.position, this.collider.offset);
        const otherPos = Vector2.add(other.position, other.collider.offset);
        
        if (this.collider.type === 'circle' && other.collider.type === 'circle') {
            return this.checkCircleCircleCollision(thisPos, otherPos, other);
        } else if (this.collider.type === 'rect' && other.collider.type === 'rect') {
            return this.checkRectRectCollision(thisPos, otherPos, other);
        } else {
            // 混合碰撞检测
            return this.checkMixedCollision(thisPos, otherPos, other);
        }
    }

    // 圆形-圆形碰撞检测
    checkCircleCircleCollision(thisPos, otherPos, other) {
        const distance = thisPos.distanceTo(otherPos);
        return distance < (this.collider.radius + other.collider.radius);
    }

    // 矩形-矩形碰撞检测
    checkRectRectCollision(thisPos, otherPos, other) {
        const thisLeft = thisPos.x - this.collider.width / 2;
        const thisRight = thisPos.x + this.collider.width / 2;
        const thisTop = thisPos.y - this.collider.height / 2;
        const thisBottom = thisPos.y + this.collider.height / 2;
        
        const otherLeft = otherPos.x - other.collider.width / 2;
        const otherRight = otherPos.x + other.collider.width / 2;
        const otherTop = otherPos.y - other.collider.height / 2;
        const otherBottom = otherPos.y + other.collider.height / 2;
        
        return !(thisRight < otherLeft || thisLeft > otherRight || 
                thisBottom < otherTop || thisTop > otherBottom);
    }

    // 混合碰撞检测
    checkMixedCollision(thisPos, otherPos, other) {
        // 简化实现：使用AABB检测
        const thisBounds = this.getBounds();
        const otherBounds = other.getBounds();
        
        return !(thisBounds.right < otherBounds.left || thisBounds.left > otherBounds.right ||
                thisBounds.bottom < otherBounds.top || thisBounds.top > otherBounds.bottom);
    }

    // 获取边界框
    getBounds() {
        const pos = Vector2.add(this.position, this.collider.offset);
        
        if (this.collider.type === 'circle') {
            const r = this.collider.radius;
            return {
                left: pos.x - r,
                right: pos.x + r,
                top: pos.y - r,
                bottom: pos.y + r
            };
        } else {
            const w = this.collider.width / 2;
            const h = this.collider.height / 2;
            return {
                left: pos.x - w,
                right: pos.x + w,
                top: pos.y - h,
                bottom: pos.y + h
            };
        }
    }

    // 碰撞处理
    onCollision(other, collision) {
        // 子类重写此方法处理碰撞
    }

    // 触发器进入
    onTriggerEnter(other) {
        // 子类重写此方法处理触发器
    }

    // 触发器退出
    onTriggerExit(other) {
        // 子类重写此方法处理触发器
    }

    // 事件监听
    addEventListener(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    // 移除事件监听
    removeEventListener(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // 触发事件
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                handler(data);
            });
        }
    }

    // 设置位置
    setPosition(x, y) {
        this.position.set(x, y);
        if (this.physicsBody) {
            this.physicsBody.position.set(x, y);
        }
    }

    // 移动
    move(deltaX, deltaY) {
        this.position.add(new Vector2(deltaX, deltaY));
        if (this.physicsBody) {
            this.physicsBody.position.copy(this.position);
        }
    }

    // 设置速度
    setVelocity(x, y) {
        this.velocity.set(x, y);
        if (this.physicsBody) {
            this.physicsBody.velocity.set(x, y);
        }
    }

    // 应用力
    applyForce(force) {
        if (this.physicsBody) {
            this.physicsBody.applyForce(force);
        } else {
            this.acceleration.add(force);
        }
    }

    // 应用冲量
    applyImpulse(impulse) {
        if (this.physicsBody) {
            this.physicsBody.applyImpulse(impulse);
        } else {
            this.velocity.add(impulse);
        }
    }

    // 获取距离
    getDistanceTo(other) {
        return this.position.distanceTo(other.position);
    }

    // 获取方向
    getDirectionTo(other) {
        return Vector2.subtract(other.position, this.position).normalize();
    }

    // 朝向目标
    lookAt(target) {
        const direction = this.getDirectionTo(target);
        this.rotation = Math.atan2(direction.y, direction.x);
    }

    // 销毁
    destroy() {
        if (this.destroyed) return;
        
        this.destroyed = true;
        this.active = false;
        this.visible = false;
        
        // 销毁组件
        this.components.forEach(component => {
            if (component.destroy) {
                component.destroy();
            }
        });
        this.components.clear();
        
        // 移除物理体
        if (this.physicsBody && window.physicsEngine) {
            window.physicsEngine.removeBody(this.physicsBody);
        }
        
        // 清除事件监听器
        this.eventHandlers.clear();
        
        // 子类销毁逻辑
        this.onDestroy();
        
        // 发送销毁事件
        gameEventBus.emit('entity_destroyed', { entity: this });
    }

    // 子类销毁逻辑（子类重写）
    onDestroy() {
        // 子类实现具体销毁逻辑
    }

    // 克隆实体
    clone() {
        const cloned = new this.constructor(this.position.x, this.position.y);
        
        // 复制基本属性
        cloned.velocity.copy(this.velocity);
        cloned.acceleration.copy(this.acceleration);
        cloned.rotation = this.rotation;
        cloned.scale.copy(this.scale);
        cloned.width = this.width;
        cloned.height = this.height;
        cloned.sprite = this.sprite;
        cloned.color = this.color;
        cloned.alpha = this.alpha;
        cloned.layer = this.layer;
        cloned.zIndex = this.zIndex;
        
        // 复制标签
        this.tags.forEach(tag => cloned.addTag(tag));
        
        // 复制用户数据
        cloned.userData = { ...this.userData };
        
        return cloned;
    }

    // 序列化
    serialize() {
        return {
            id: this.id,
            type: this.constructor.name,
            position: { x: this.position.x, y: this.position.y },
            velocity: { x: this.velocity.x, y: this.velocity.y },
            rotation: this.rotation,
            scale: { x: this.scale.x, y: this.scale.y },
            width: this.width,
            height: this.height,
            active: this.active,
            visible: this.visible,
            tags: Array.from(this.tags),
            userData: this.userData
        };
    }

    // 反序列化
    static deserialize(data) {
        const entity = new Entity(data.position.x, data.position.y);
        
        entity.id = data.id;
        entity.velocity.set(data.velocity.x, data.velocity.y);
        entity.rotation = data.rotation;
        entity.scale.set(data.scale.x, data.scale.y);
        entity.width = data.width;
        entity.height = data.height;
        entity.active = data.active;
        entity.visible = data.visible;
        entity.userData = data.userData;
        
        data.tags.forEach(tag => entity.addTag(tag));
        
        return entity;
    }

    // 调试信息
    debug() {
        console.log(`Entity ${this.id} (${this.constructor.name}):`);
        console.log(`  Position: ${this.position.toString()}`);
        console.log(`  Velocity: ${this.velocity.toString()}`);
        console.log(`  Size: ${this.width}x${this.height}`);
        console.log(`  Active: ${this.active}`);
        console.log(`  Visible: ${this.visible}`);
        console.log(`  Components: ${this.components.size}`);
        console.log(`  Tags: ${Array.from(this.tags).join(', ')}`);
    }
}

