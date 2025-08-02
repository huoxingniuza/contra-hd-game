/**
 * 2D向量类 - 用于处理游戏中的位置、速度、方向等
 */
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // 创建向量副本
    clone() {
        return new Vector2(this.x, this.y);
    }

    // 设置向量值
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    // 从另一个向量复制值
    copy(vector) {
        this.x = vector.x;
        this.y = vector.y;
        return this;
    }

    // 向量加法
    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    }

    // 向量减法
    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
    }

    // 向量乘法（标量）
    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    // 向量除法（标量）
    divide(scalar) {
        if (scalar !== 0) {
            this.x /= scalar;
            this.y /= scalar;
        }
        return this;
    }

    // 计算向量长度
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    // 计算向量长度的平方（避免开方运算，用于比较）
    magnitudeSquared() {
        return this.x * this.x + this.y * this.y;
    }

    // 向量归一化
    normalize() {
        const mag = this.magnitude();
        if (mag > 0) {
            this.divide(mag);
        }
        return this;
    }

    // 获取归一化向量（不修改原向量）
    normalized() {
        return this.clone().normalize();
    }

    // 计算两向量距离
    distanceTo(vector) {
        const dx = this.x - vector.x;
        const dy = this.y - vector.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 计算两向量距离的平方
    distanceToSquared(vector) {
        const dx = this.x - vector.x;
        const dy = this.y - vector.y;
        return dx * dx + dy * dy;
    }

    // 向量点积
    dot(vector) {
        return this.x * vector.x + this.y * vector.y;
    }

    // 向量叉积（2D中返回标量）
    cross(vector) {
        return this.x * vector.y - this.y * vector.x;
    }

    // 获取向量角度（弧度）
    angle() {
        return Math.atan2(this.y, this.x);
    }

    // 从角度创建单位向量
    static fromAngle(angle) {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }

    // 向量旋转
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.y * sin;
        const y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    // 线性插值
    lerp(vector, t) {
        this.x += (vector.x - this.x) * t;
        this.y += (vector.y - this.y) * t;
        return this;
    }

    // 限制向量长度
    limit(max) {
        const magSq = this.magnitudeSquared();
        if (magSq > max * max) {
            this.normalize().multiply(max);
        }
        return this;
    }

    // 设置向量长度
    setMagnitude(mag) {
        return this.normalize().multiply(mag);
    }

    // 检查向量是否为零向量
    isZero() {
        return this.x === 0 && this.y === 0;
    }

    // 向量反向
    negate() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    // 获取反向向量
    negated() {
        return new Vector2(-this.x, -this.y);
    }

    // 向量相等比较
    equals(vector, tolerance = 0.0001) {
        return Math.abs(this.x - vector.x) < tolerance && 
               Math.abs(this.y - vector.y) < tolerance;
    }

    // 转换为字符串
    toString() {
        return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }

    // 静态方法：向量加法
    static add(v1, v2) {
        return new Vector2(v1.x + v2.x, v1.y + v2.y);
    }

    // 静态方法：向量减法
    static subtract(v1, v2) {
        return new Vector2(v1.x - v2.x, v1.y - v2.y);
    }

    // 静态方法：向量乘法
    static multiply(vector, scalar) {
        return new Vector2(vector.x * scalar, vector.y * scalar);
    }

    // 静态方法：向量距离
    static distance(v1, v2) {
        return v1.distanceTo(v2);
    }

    // 静态方法：向量点积
    static dot(v1, v2) {
        return v1.dot(v2);
    }

    // 静态方法：线性插值
    static lerp(v1, v2, t) {
        return new Vector2(
            v1.x + (v2.x - v1.x) * t,
            v1.y + (v2.y - v1.y) * t
        );
    }

    // 常用向量常量
    static get ZERO() { return new Vector2(0, 0); }
    static get ONE() { return new Vector2(1, 1); }
    static get UP() { return new Vector2(0, -1); }
    static get DOWN() { return new Vector2(0, 1); }
    static get LEFT() { return new Vector2(-1, 0); }
    static get RIGHT() { return new Vector2(1, 0); }
}

