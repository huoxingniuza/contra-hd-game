/**
 * 物理引擎 - 处理2D物理模拟和碰撞检测
 */
class PhysicsEngine {
    constructor() {
        // 物理世界设置
        this.gravity = new Vector2(0, 980); // 重力加速度 (pixels/s²)
        this.timeStep = 1/60; // 固定时间步长
        this.velocityIterations = 8;
        this.positionIterations = 3;
        
        // 物理体管理
        this.bodies = new Map();
        this.staticBodies = new Set();
        this.dynamicBodies = new Set();
        
        // 碰撞检测
        this.collisionPairs = new Set();
        this.broadPhase = new SpatialHash(64); // 空间哈希网格大小
        
        // 约束和关节
        this.constraints = [];
        
        // 物理材质
        this.materials = new Map();
        this.setupDefaultMaterials();
        
        // 调试渲染
        this.debugRender = false;
        
        // 性能统计
        this.stats = {
            bodyCount: 0,
            collisionChecks: 0,
            collisionsDetected: 0
        };
    }

    // 设置默认材质
    setupDefaultMaterials() {
        this.materials.set('default', {
            density: 1.0,
            friction: 0.3,
            restitution: 0.2
        });
        
        this.materials.set('bouncy', {
            density: 1.0,
            friction: 0.1,
            restitution: 0.9
        });
        
        this.materials.set('ice', {
            density: 1.0,
            friction: 0.05,
            restitution: 0.1
        });
        
        this.materials.set('sticky', {
            density: 1.0,
            friction: 0.9,
            restitution: 0.0
        });
    }

    // 创建物理体
    createBody(options = {}) {
        const body = new PhysicsBody(options);
        
        this.bodies.set(body.id, body);
        
        if (body.type === 'static') {
            this.staticBodies.add(body);
        } else {
            this.dynamicBodies.add(body);
        }
        
        this.stats.bodyCount++;
        return body;
    }

    // 移除物理体
    removeBody(body) {
        if (this.bodies.has(body.id)) {
            this.bodies.delete(body.id);
            this.staticBodies.delete(body);
            this.dynamicBodies.delete(body);
            this.stats.bodyCount--;
        }
    }

    // 物理更新
    update(deltaTime) {
        // 重置统计
        this.stats.collisionChecks = 0;
        this.stats.collisionsDetected = 0;
        
        // 更新动态物体
        this.updateDynamicBodies(deltaTime);
        
        // 碰撞检测
        this.detectCollisions();
        
        // 解决碰撞
        this.resolveCollisions();
        
        // 更新空间哈希
        this.updateSpatialHash();
        
        // 发送物理更新事件
        gameEventBus.emit(GameEvents.PHYSICS_UPDATE, {
            deltaTime: deltaTime,
            bodyCount: this.stats.bodyCount
        });
    }

    // 更新动态物体
    updateDynamicBodies(deltaTime) {
        this.dynamicBodies.forEach(body => {
            if (!body.enabled) return;
            
            // 应用重力
            if (body.useGravity) {
                body.velocity.add(Vector2.multiply(this.gravity, deltaTime));
            }
            
            // 应用阻尼
            body.velocity.multiply(Math.pow(1 - body.linearDamping, deltaTime));
            body.angularVelocity *= Math.pow(1 - body.angularDamping, deltaTime);
            
            // 限制速度
            if (body.maxVelocity > 0) {
                body.velocity.limit(body.maxVelocity);
            }
            
            // 更新位置
            const deltaPos = Vector2.multiply(body.velocity, deltaTime);
            body.position.add(deltaPos);
            
            // 更新旋转
            body.rotation += body.angularVelocity * deltaTime;
            
            // 更新边界框
            body.updateBounds();
        });
    }

    // 碰撞检测
    detectCollisions() {
        this.collisionPairs.clear();
        
        // 广相检测 - 使用空间哈希
        const potentialPairs = this.broadPhase.getPotentialCollisions();
        
        potentialPairs.forEach(pair => {
            const [bodyA, bodyB] = pair;
            this.stats.collisionChecks++;
            
            // 跳过相同物体
            if (bodyA === bodyB) return;
            
            // 跳过两个静态物体
            if (bodyA.type === 'static' && bodyB.type === 'static') return;
            
            // 检查碰撞层
            if (!this.shouldCollide(bodyA, bodyB)) return;
            
            // 精确碰撞检测
            const collision = this.checkCollision(bodyA, bodyB);
            if (collision) {
                this.collisionPairs.add(collision);
                this.stats.collisionsDetected++;
                
                // 发送碰撞事件
                this.emitCollisionEvent(bodyA, bodyB, collision);
            }
        });
    }

    // 检查两个物体是否应该碰撞
    shouldCollide(bodyA, bodyB) {
        // 检查碰撞层
        return (bodyA.collisionMask & bodyB.collisionLayer) !== 0 ||
               (bodyB.collisionMask & bodyA.collisionLayer) !== 0;
    }

    // 精确碰撞检测
    checkCollision(bodyA, bodyB) {
        // AABB预检测
        if (!this.aabbOverlap(bodyA.bounds, bodyB.bounds)) {
            return null;
        }
        
        // 根据形状类型选择检测方法
        if (bodyA.shape.type === 'circle' && bodyB.shape.type === 'circle') {
            return this.circleCircleCollision(bodyA, bodyB);
        } else if (bodyA.shape.type === 'rect' && bodyB.shape.type === 'rect') {
            return this.rectRectCollision(bodyA, bodyB);
        } else if (bodyA.shape.type === 'circle' && bodyB.shape.type === 'rect') {
            return this.circleRectCollision(bodyA, bodyB);
        } else if (bodyA.shape.type === 'rect' && bodyB.shape.type === 'circle') {
            return this.circleRectCollision(bodyB, bodyA);
        }
        
        return null;
    }

    // AABB重叠检测
    aabbOverlap(boundsA, boundsB) {
        return !(boundsA.right < boundsB.left ||
                boundsA.left > boundsB.right ||
                boundsA.bottom < boundsB.top ||
                boundsA.top > boundsB.bottom);
    }

    // 圆形-圆形碰撞检测
    circleCircleCollision(bodyA, bodyB) {
        const distance = bodyA.position.distanceTo(bodyB.position);
        const radiusSum = bodyA.shape.radius + bodyB.shape.radius;
        
        if (distance < radiusSum) {
            const normal = Vector2.subtract(bodyB.position, bodyA.position).normalize();
            const penetration = radiusSum - distance;
            
            return {
                bodyA: bodyA,
                bodyB: bodyB,
                normal: normal,
                penetration: penetration,
                contactPoint: Vector2.add(bodyA.position, Vector2.multiply(normal, bodyA.shape.radius))
            };
        }
        
        return null;
    }

    // 矩形-矩形碰撞检测
    rectRectCollision(bodyA, bodyB) {
        const boundsA = bodyA.bounds;
        const boundsB = bodyB.bounds;
        
        const overlapX = Math.min(boundsA.right, boundsB.right) - Math.max(boundsA.left, boundsB.left);
        const overlapY = Math.min(boundsA.bottom, boundsB.bottom) - Math.max(boundsA.top, boundsB.top);
        
        if (overlapX > 0 && overlapY > 0) {
            let normal, penetration;
            
            if (overlapX < overlapY) {
                // 水平碰撞
                normal = new Vector2(bodyA.position.x < bodyB.position.x ? -1 : 1, 0);
                penetration = overlapX;
            } else {
                // 垂直碰撞
                normal = new Vector2(0, bodyA.position.y < bodyB.position.y ? -1 : 1);
                penetration = overlapY;
            }
            
            return {
                bodyA: bodyA,
                bodyB: bodyB,
                normal: normal,
                penetration: penetration,
                contactPoint: new Vector2(
                    (Math.max(boundsA.left, boundsB.left) + Math.min(boundsA.right, boundsB.right)) / 2,
                    (Math.max(boundsA.top, boundsB.top) + Math.min(boundsA.bottom, boundsB.bottom)) / 2
                )
            };
        }
        
        return null;
    }

    // 圆形-矩形碰撞检测
    circleRectCollision(circleBody, rectBody) {
        const circle = circleBody.position;
        const rect = rectBody.bounds;
        
        // 找到矩形上最近的点
        const closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
        const closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
        
        const distance = circle.distanceTo(new Vector2(closestX, closestY));
        
        if (distance < circleBody.shape.radius) {
            const normal = Vector2.subtract(circle, new Vector2(closestX, closestY)).normalize();
            const penetration = circleBody.shape.radius - distance;
            
            return {
                bodyA: circleBody,
                bodyB: rectBody,
                normal: normal,
                penetration: penetration,
                contactPoint: new Vector2(closestX, closestY)
            };
        }
        
        return null;
    }

    // 解决碰撞
    resolveCollisions() {
        this.collisionPairs.forEach(collision => {
            this.resolveCollision(collision);
        });
    }

    // 解决单个碰撞
    resolveCollision(collision) {
        const { bodyA, bodyB, normal, penetration } = collision;
        
        // 位置修正
        this.resolvePosition(bodyA, bodyB, normal, penetration);
        
        // 速度修正
        this.resolveVelocity(bodyA, bodyB, normal);
    }

    // 位置修正
    resolvePosition(bodyA, bodyB, normal, penetration) {
        const totalInvMass = bodyA.getInverseMass() + bodyB.getInverseMass();
        if (totalInvMass === 0) return;
        
        const correction = Vector2.multiply(normal, penetration / totalInvMass * 0.8); // 80%修正
        
        if (bodyA.type === 'dynamic') {
            bodyA.position.subtract(Vector2.multiply(correction, bodyA.getInverseMass()));
            bodyA.updateBounds();
        }
        
        if (bodyB.type === 'dynamic') {
            bodyB.position.add(Vector2.multiply(correction, bodyB.getInverseMass()));
            bodyB.updateBounds();
        }
    }

    // 速度修正
    resolveVelocity(bodyA, bodyB, normal) {
        const relativeVelocity = Vector2.subtract(bodyB.velocity, bodyA.velocity);
        const velocityAlongNormal = relativeVelocity.dot(normal);
        
        // 如果物体正在分离，不需要修正
        if (velocityAlongNormal > 0) return;
        
        // 计算反弹系数
        const restitution = Math.min(bodyA.material.restitution, bodyB.material.restitution);
        
        // 计算冲量
        const impulseScalar = -(1 + restitution) * velocityAlongNormal;
        const totalInvMass = bodyA.getInverseMass() + bodyB.getInverseMass();
        
        if (totalInvMass === 0) return;
        
        const impulse = Vector2.multiply(normal, impulseScalar / totalInvMass);
        
        // 应用冲量
        if (bodyA.type === 'dynamic') {
            bodyA.velocity.subtract(Vector2.multiply(impulse, bodyA.getInverseMass()));
        }
        
        if (bodyB.type === 'dynamic') {
            bodyB.velocity.add(Vector2.multiply(impulse, bodyB.getInverseMass()));
        }
        
        // 摩擦力
        this.applyFriction(bodyA, bodyB, normal, impulseScalar);
    }

    // 应用摩擦力
    applyFriction(bodyA, bodyB, normal, impulseScalar) {
        const relativeVelocity = Vector2.subtract(bodyB.velocity, bodyA.velocity);
        const tangent = Vector2.subtract(relativeVelocity, Vector2.multiply(normal, relativeVelocity.dot(normal))).normalize();
        
        const frictionImpulse = -relativeVelocity.dot(tangent);
        const totalInvMass = bodyA.getInverseMass() + bodyB.getInverseMass();
        
        if (totalInvMass === 0) return;
        
        const mu = Math.sqrt(bodyA.material.friction * bodyB.material.friction);
        
        let friction;
        if (Math.abs(frictionImpulse) < impulseScalar * mu) {
            friction = Vector2.multiply(tangent, frictionImpulse / totalInvMass);
        } else {
            friction = Vector2.multiply(tangent, -impulseScalar * mu / totalInvMass);
        }
        
        // 应用摩擦力
        if (bodyA.type === 'dynamic') {
            bodyA.velocity.subtract(Vector2.multiply(friction, bodyA.getInverseMass()));
        }
        
        if (bodyB.type === 'dynamic') {
            bodyB.velocity.add(Vector2.multiply(friction, bodyB.getInverseMass()));
        }
    }

    // 更新空间哈希
    updateSpatialHash() {
        this.broadPhase.clear();
        
        this.bodies.forEach(body => {
            if (body.enabled) {
                this.broadPhase.insert(body);
            }
        });
    }

    // 发送碰撞事件
    emitCollisionEvent(bodyA, bodyB, collision) {
        const eventData = {
            bodyA: bodyA,
            bodyB: bodyB,
            collision: collision
        };
        
        // 根据物体类型发送不同事件
        if (bodyA.userData && bodyB.userData) {
            const typeA = bodyA.userData.type;
            const typeB = bodyB.userData.type;
            
            if ((typeA === 'player' && typeB === 'enemy') || (typeA === 'enemy' && typeB === 'player')) {
                gameEventBus.emit(GameEvents.COLLISION_PLAYER_ENEMY, eventData);
            } else if ((typeA === 'bullet' && typeB === 'enemy') || (typeA === 'enemy' && typeB === 'bullet')) {
                gameEventBus.emit(GameEvents.COLLISION_BULLET_ENEMY, eventData);
            } else if ((typeA === 'player' && typeB === 'powerup') || (typeA === 'powerup' && typeB === 'player')) {
                gameEventBus.emit(GameEvents.COLLISION_PLAYER_POWERUP, eventData);
            }
        }
    }

    // 射线检测
    raycast(origin, direction, maxDistance = Infinity, layerMask = 0xFFFFFFFF) {
        const hits = [];
        
        this.bodies.forEach(body => {
            if (!body.enabled || (body.collisionLayer & layerMask) === 0) return;
            
            const hit = this.raycastBody(origin, direction, maxDistance, body);
            if (hit) {
                hits.push(hit);
            }
        });
        
        // 按距离排序
        hits.sort((a, b) => a.distance - b.distance);
        
        return hits;
    }

    // 对单个物体进行射线检测
    raycastBody(origin, direction, maxDistance, body) {
        // 简化实现：只支持矩形
        if (body.shape.type !== 'rect') return null;
        
        const bounds = body.bounds;
        const dirNorm = direction.normalized();
        
        // 计算射线与AABB的交点
        const tMin = (bounds.left - origin.x) / dirNorm.x;
        const tMax = (bounds.right - origin.x) / dirNorm.x;
        const tYMin = (bounds.top - origin.y) / dirNorm.y;
        const tYMax = (bounds.bottom - origin.y) / dirNorm.y;
        
        const tNear = Math.max(Math.min(tMin, tMax), Math.min(tYMin, tYMax));
        const tFar = Math.min(Math.max(tMin, tMax), Math.max(tYMin, tYMax));
        
        if (tNear <= tFar && tNear >= 0 && tNear <= maxDistance) {
            const hitPoint = Vector2.add(origin, Vector2.multiply(dirNorm, tNear));
            
            return {
                body: body,
                point: hitPoint,
                distance: tNear,
                normal: this.calculateHitNormal(hitPoint, bounds)
            };
        }
        
        return null;
    }

    // 计算碰撞法线
    calculateHitNormal(point, bounds) {
        const center = new Vector2(
            (bounds.left + bounds.right) / 2,
            (bounds.top + bounds.bottom) / 2
        );
        
        const diff = Vector2.subtract(point, center);
        const absX = Math.abs(diff.x);
        const absY = Math.abs(diff.y);
        
        if (absX > absY) {
            return new Vector2(diff.x > 0 ? 1 : -1, 0);
        } else {
            return new Vector2(0, diff.y > 0 ? 1 : -1);
        }
    }

    // 设置重力
    setGravity(x, y) {
        this.gravity.set(x, y);
    }

    // 获取统计信息
    getStats() {
        return { ...this.stats };
    }

    // 调试信息
    debug() {
        console.log('Physics Engine Debug Info:');
        console.log(`  Bodies: ${this.stats.bodyCount}`);
        console.log(`  Static: ${this.staticBodies.size}`);
        console.log(`  Dynamic: ${this.dynamicBodies.size}`);
        console.log(`  Collision Checks: ${this.stats.collisionChecks}`);
        console.log(`  Collisions: ${this.stats.collisionsDetected}`);
        console.log(`  Gravity: ${this.gravity.toString()}`);
    }
}

/**
 * 物理体类
 */
class PhysicsBody {
    constructor(options = {}) {
        this.id = Math.random().toString(36).substr(2, 9);
        
        // 基本属性
        this.position = options.position ? options.position.clone() : new Vector2();
        this.velocity = options.velocity ? options.velocity.clone() : new Vector2();
        this.rotation = options.rotation || 0;
        this.angularVelocity = options.angularVelocity || 0;
        
        // 物理属性
        this.mass = options.mass || 1;
        this.type = options.type || 'dynamic'; // 'static', 'dynamic', 'kinematic'
        this.useGravity = options.useGravity !== false;
        this.enabled = options.enabled !== false;
        
        // 阻尼
        this.linearDamping = options.linearDamping || 0.01;
        this.angularDamping = options.angularDamping || 0.05;
        this.maxVelocity = options.maxVelocity || 0;
        
        // 形状
        this.shape = options.shape || { type: 'rect', width: 32, height: 32 };
        
        // 材质
        this.material = options.material || { friction: 0.3, restitution: 0.2, density: 1.0 };
        
        // 碰撞
        this.collisionLayer = options.collisionLayer || 1;
        this.collisionMask = options.collisionMask || 0xFFFFFFFF;
        this.isTrigger = options.isTrigger || false;
        
        // 边界框
        this.bounds = { left: 0, top: 0, right: 0, bottom: 0 };
        this.updateBounds();
        
        // 用户数据
        this.userData = options.userData || null;
    }

    // 更新边界框
    updateBounds() {
        if (this.shape.type === 'rect') {
            const halfWidth = this.shape.width / 2;
            const halfHeight = this.shape.height / 2;
            
            this.bounds.left = this.position.x - halfWidth;
            this.bounds.right = this.position.x + halfWidth;
            this.bounds.top = this.position.y - halfHeight;
            this.bounds.bottom = this.position.y + halfHeight;
        } else if (this.shape.type === 'circle') {
            const radius = this.shape.radius;
            
            this.bounds.left = this.position.x - radius;
            this.bounds.right = this.position.x + radius;
            this.bounds.top = this.position.y - radius;
            this.bounds.bottom = this.position.y + radius;
        }
    }

    // 获取逆质量
    getInverseMass() {
        return this.type === 'static' ? 0 : 1 / this.mass;
    }

    // 应用力
    applyForce(force) {
        if (this.type === 'dynamic') {
            const acceleration = Vector2.multiply(force, this.getInverseMass());
            this.velocity.add(acceleration);
        }
    }

    // 应用冲量
    applyImpulse(impulse) {
        if (this.type === 'dynamic') {
            const deltaV = Vector2.multiply(impulse, this.getInverseMass());
            this.velocity.add(deltaV);
        }
    }
}

/**
 * 空间哈希 - 用于广相碰撞检测
 */
class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    // 清空网格
    clear() {
        this.grid.clear();
    }

    // 插入物体
    insert(body) {
        const cells = this.getCells(body.bounds);
        
        cells.forEach(cellKey => {
            if (!this.grid.has(cellKey)) {
                this.grid.set(cellKey, new Set());
            }
            this.grid.get(cellKey).add(body);
        });
    }

    // 获取物体占用的网格单元
    getCells(bounds) {
        const cells = [];
        
        const startX = Math.floor(bounds.left / this.cellSize);
        const endX = Math.floor(bounds.right / this.cellSize);
        const startY = Math.floor(bounds.top / this.cellSize);
        const endY = Math.floor(bounds.bottom / this.cellSize);
        
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                cells.push(`${x},${y}`);
            }
        }
        
        return cells;
    }

    // 获取潜在碰撞对
    getPotentialCollisions() {
        const pairs = new Set();
        const processed = new Set();
        
        this.grid.forEach(bodies => {
            const bodyArray = Array.from(bodies);
            
            for (let i = 0; i < bodyArray.length; i++) {
                for (let j = i + 1; j < bodyArray.length; j++) {
                    const bodyA = bodyArray[i];
                    const bodyB = bodyArray[j];
                    
                    const pairKey = bodyA.id < bodyB.id ? `${bodyA.id}-${bodyB.id}` : `${bodyB.id}-${bodyA.id}`;
                    
                    if (!processed.has(pairKey)) {
                        pairs.add([bodyA, bodyB]);
                        processed.add(pairKey);
                    }
                }
            }
        });
        
        return Array.from(pairs);
    }
}

