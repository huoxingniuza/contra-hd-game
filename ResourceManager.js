/**
 * 资源管理器 - 处理图像、音频、数据等资源的加载和缓存
 */
class ResourceManager {
    constructor() {
        // 资源缓存
        this.images = new Map();
        this.audio = new Map();
        this.data = new Map();
        
        // 加载状态
        this.loadingQueue = new Map();
        this.loadedResources = new Set();
        this.failedResources = new Set();
        
        // 加载统计
        this.totalResources = 0;
        this.loadedCount = 0;
        this.failedCount = 0;
        
        // 缓存配置
        this.maxCacheSize = 100 * 1024 * 1024; // 100MB
        this.currentCacheSize = 0;
        
        // 预加载配置
        this.preloadQueue = [];
        this.isPreloading = false;
        
        // 支持的格式
        this.supportedImageFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        this.supportedAudioFormats = ['mp3', 'ogg', 'wav', 'aac'];
        
        // 检测浏览器支持的格式
        this.detectSupportedFormats();
    }

    // 检测浏览器支持的格式
    detectSupportedFormats() {
        // 检测WebP支持
        const webpSupported = this.checkWebPSupport();
        if (!webpSupported) {
            this.supportedImageFormats = this.supportedImageFormats.filter(format => format !== 'webp');
        }
        
        // 检测音频格式支持
        const audio = new Audio();
        this.audioSupport = {
            mp3: !!audio.canPlayType('audio/mpeg'),
            ogg: !!audio.canPlayType('audio/ogg'),
            wav: !!audio.canPlayType('audio/wav'),
            aac: !!audio.canPlayType('audio/aac')
        };
    }

    // 检测WebP支持
    checkWebPSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    // 加载图像
    async loadImage(url, key = null) {
        const resourceKey = key || url;
        
        // 检查是否已加载
        if (this.images.has(resourceKey)) {
            return this.images.get(resourceKey);
        }
        
        // 检查是否正在加载
        if (this.loadingQueue.has(resourceKey)) {
            return this.loadingQueue.get(resourceKey);
        }
        
        // 创建加载Promise
        const loadPromise = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.images.set(resourceKey, img);
                this.loadedResources.add(resourceKey);
                this.loadingQueue.delete(resourceKey);
                this.loadedCount++;
                
                // 更新缓存大小估算
                this.updateCacheSize(img.width * img.height * 4); // 假设RGBA
                
                gameEventBus.emit(GameEvents.RESOURCE_LOADED, {
                    type: 'image',
                    key: resourceKey,
                    url: url,
                    resource: img
                });
                
                resolve(img);
            };
            
            img.onerror = () => {
                this.failedResources.add(resourceKey);
                this.loadingQueue.delete(resourceKey);
                this.failedCount++;
                
                const error = new Error(`Failed to load image: ${url}`);
                gameEventBus.emit(GameEvents.RESOURCE_ERROR, {
                    type: 'image',
                    key: resourceKey,
                    url: url,
                    error: error
                });
                
                reject(error);
            };
            
            img.crossOrigin = 'anonymous';
            img.src = url;
        });
        
        this.loadingQueue.set(resourceKey, loadPromise);
        this.totalResources++;
        
        return loadPromise;
    }

    // 加载音频
    async loadAudio(url, key = null) {
        const resourceKey = key || url;
        
        // 检查是否已加载
        if (this.audio.has(resourceKey)) {
            return this.audio.get(resourceKey);
        }
        
        // 检查是否正在加载
        if (this.loadingQueue.has(resourceKey)) {
            return this.loadingQueue.get(resourceKey);
        }
        
        // 创建加载Promise
        const loadPromise = new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.oncanplaythrough = () => {
                this.audio.set(resourceKey, audio);
                this.loadedResources.add(resourceKey);
                this.loadingQueue.delete(resourceKey);
                this.loadedCount++;
                
                gameEventBus.emit(GameEvents.RESOURCE_LOADED, {
                    type: 'audio',
                    key: resourceKey,
                    url: url,
                    resource: audio
                });
                
                resolve(audio);
            };
            
            audio.onerror = () => {
                this.failedResources.add(resourceKey);
                this.loadingQueue.delete(resourceKey);
                this.failedCount++;
                
                const error = new Error(`Failed to load audio: ${url}`);
                gameEventBus.emit(GameEvents.RESOURCE_ERROR, {
                    type: 'audio',
                    key: resourceKey,
                    url: url,
                    error: error
                });
                
                reject(error);
            };
            
            audio.crossOrigin = 'anonymous';
            audio.preload = 'auto';
            audio.src = url;
        });
        
        this.loadingQueue.set(resourceKey, loadPromise);
        this.totalResources++;
        
        return loadPromise;
    }

    // 加载JSON数据
    async loadJSON(url, key = null) {
        const resourceKey = key || url;
        
        // 检查是否已加载
        if (this.data.has(resourceKey)) {
            return this.data.get(resourceKey);
        }
        
        // 检查是否正在加载
        if (this.loadingQueue.has(resourceKey)) {
            return this.loadingQueue.get(resourceKey);
        }
        
        // 创建加载Promise
        const loadPromise = fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.data.set(resourceKey, data);
                this.loadedResources.add(resourceKey);
                this.loadingQueue.delete(resourceKey);
                this.loadedCount++;
                
                gameEventBus.emit(GameEvents.RESOURCE_LOADED, {
                    type: 'json',
                    key: resourceKey,
                    url: url,
                    resource: data
                });
                
                return data;
            })
            .catch(error => {
                this.failedResources.add(resourceKey);
                this.loadingQueue.delete(resourceKey);
                this.failedCount++;
                
                gameEventBus.emit(GameEvents.RESOURCE_ERROR, {
                    type: 'json',
                    key: resourceKey,
                    url: url,
                    error: error
                });
                
                throw error;
            });
        
        this.loadingQueue.set(resourceKey, loadPromise);
        this.totalResources++;
        
        return loadPromise;
    }

    // 批量加载资源
    async loadResources(resources) {
        const promises = resources.map(resource => {
            const { type, url, key } = resource;
            
            switch (type) {
                case 'image':
                    return this.loadImage(url, key);
                case 'audio':
                    return this.loadAudio(url, key);
                case 'json':
                    return this.loadJSON(url, key);
                default:
                    console.warn(`Unknown resource type: ${type}`);
                    return Promise.resolve(null);
            }
        });
        
        return Promise.allSettled(promises);
    }

    // 预加载资源
    async preloadResources(resources) {
        if (this.isPreloading) {
            console.warn('Preloading already in progress');
            return;
        }
        
        this.isPreloading = true;
        this.preloadQueue = [...resources];
        
        try {
            await this.loadResources(resources);
            console.log('Preloading completed');
        } catch (error) {
            console.error('Preloading failed:', error);
        } finally {
            this.isPreloading = false;
            this.preloadQueue = [];
        }
    }

    // 获取资源
    getImage(key) {
        return this.images.get(key);
    }

    getAudio(key) {
        return this.audio.get(key);
    }

    getData(key) {
        return this.data.get(key);
    }

    // 检查资源是否已加载
    isLoaded(key) {
        return this.loadedResources.has(key);
    }

    // 检查资源是否加载失败
    isFailed(key) {
        return this.failedResources.has(key);
    }

    // 检查资源是否正在加载
    isLoading(key) {
        return this.loadingQueue.has(key);
    }

    // 获取加载进度
    getLoadingProgress() {
        if (this.totalResources === 0) return 1;
        return this.loadedCount / this.totalResources;
    }

    // 获取加载统计
    getLoadingStats() {
        return {
            total: this.totalResources,
            loaded: this.loadedCount,
            failed: this.failedCount,
            loading: this.loadingQueue.size,
            progress: this.getLoadingProgress()
        };
    }

    // 清除资源缓存
    clearCache() {
        this.images.clear();
        this.audio.clear();
        this.data.clear();
        this.loadedResources.clear();
        this.failedResources.clear();
        this.currentCacheSize = 0;
        
        console.log('Resource cache cleared');
    }

    // 移除特定资源
    removeResource(key) {
        this.images.delete(key);
        this.audio.delete(key);
        this.data.delete(key);
        this.loadedResources.delete(key);
        this.failedResources.delete(key);
    }

    // 更新缓存大小
    updateCacheSize(size) {
        this.currentCacheSize += size;
        
        // 如果超过最大缓存大小，清理最少使用的资源
        if (this.currentCacheSize > this.maxCacheSize) {
            this.cleanupCache();
        }
    }

    // 清理缓存
    cleanupCache() {
        // 简单的清理策略：清除一半的图像缓存
        const imagesToRemove = Math.floor(this.images.size / 2);
        const imageKeys = Array.from(this.images.keys());
        
        for (let i = 0; i < imagesToRemove; i++) {
            this.removeResource(imageKeys[i]);
        }
        
        this.currentCacheSize = Math.floor(this.currentCacheSize / 2);
        console.log('Cache cleanup performed');
    }

    // 获取最佳音频格式
    getBestAudioFormat(baseUrl) {
        const formats = ['ogg', 'mp3', 'wav'];
        
        for (const format of formats) {
            if (this.audioSupport[format]) {
                return `${baseUrl}.${format}`;
            }
        }
        
        return `${baseUrl}.mp3`; // 默认回退
    }

    // 创建精灵图集
    createSpriteSheet(imageKey, spriteData) {
        const image = this.getImage(imageKey);
        if (!image) {
            console.error(`Image not found: ${imageKey}`);
            return null;
        }
        
        const spriteSheet = {
            image: image,
            sprites: new Map()
        };
        
        // 添加精灵定义
        for (const [spriteName, spriteInfo] of Object.entries(spriteData)) {
            spriteSheet.sprites.set(spriteName, {
                x: spriteInfo.x,
                y: spriteInfo.y,
                width: spriteInfo.width,
                height: spriteInfo.height,
                offsetX: spriteInfo.offsetX || 0,
                offsetY: spriteInfo.offsetY || 0
            });
        }
        
        return spriteSheet;
    }

    // 获取精灵
    getSprite(spriteSheet, spriteName) {
        if (!spriteSheet || !spriteSheet.sprites.has(spriteName)) {
            return null;
        }
        
        return {
            image: spriteSheet.image,
            ...spriteSheet.sprites.get(spriteName)
        };
    }

    // 调试信息
    debug() {
        console.log('Resource Manager Debug Info:');
        console.log(`  Images: ${this.images.size}`);
        console.log(`  Audio: ${this.audio.size}`);
        console.log(`  Data: ${this.data.size}`);
        console.log(`  Loading: ${this.loadingQueue.size}`);
        console.log(`  Cache Size: ${(this.currentCacheSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Progress: ${(this.getLoadingProgress() * 100).toFixed(1)}%`);
        console.log('  Audio Support:', this.audioSupport);
    }
}

