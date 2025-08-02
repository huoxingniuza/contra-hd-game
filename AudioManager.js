/**
 * 音频管理器 - 处理游戏音效和背景音乐
 */
class AudioManager {
    constructor() {
        // 音频上下文
        this.audioContext = null;
        this.masterGain = null;
        
        // 音频分类
        this.musicVolume = 0.7;
        this.sfxVolume = 0.8;
        this.masterVolume = 1.0;
        
        // 音频实例管理
        this.musicTracks = new Map();
        this.sfxSounds = new Map();
        this.activeSounds = new Set();
        
        // 当前播放状态
        this.currentMusic = null;
        this.musicFading = false;
        
        // 音频池
        this.audioPool = new Map();
        this.maxPoolSize = 10;
        
        // 初始化状态
        this.initialized = false;
        this.muted = false;
        
        // 移动端音频解锁
        this.unlocked = false;
        
        // 设置音频解锁监听器
        this.setupAudioUnlock();
    }

    // 初始化音频系统
    async initialize() {
        if (this.initialized) return;
        
        try {
            // 创建音频上下文
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // 创建主增益节点
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.masterVolume;
            
            this.initialized = true;
            console.log('Audio system initialized');
            
            // 在移动设备上需要用户交互才能播放音频
            if (this.audioContext.state === 'suspended') {
                await this.unlockAudio();
            }
            
        } catch (error) {
            console.error('Failed to initialize audio system:', error);
        }
    }

    // 设置音频解锁监听器（移动端）
    setupAudioUnlock() {
        const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown'];
        
        const unlock = async () => {
            if (this.unlocked) return;
            
            await this.unlockAudio();
            
            // 移除监听器
            unlockEvents.forEach(event => {
                document.removeEventListener(event, unlock);
            });
        };
        
        unlockEvents.forEach(event => {
            document.addEventListener(event, unlock, { once: true });
        });
    }

    // 解锁音频（移动端需要）
    async unlockAudio() {
        if (!this.audioContext || this.unlocked) return;
        
        try {
            await this.audioContext.resume();
            
            // 播放一个静音音频来解锁
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            
            this.unlocked = true;
            console.log('Audio unlocked');
        } catch (error) {
            console.error('Failed to unlock audio:', error);
        }
    }

    // 加载音频文件
    async loadAudio(url, key, type = 'sfx') {
        if (!this.initialized) {
            await this.initialize();
        }
        
        try {
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.preload = 'auto';
            
            return new Promise((resolve, reject) => {
                audio.oncanplaythrough = () => {
                    if (type === 'music') {
                        this.musicTracks.set(key, audio);
                    } else {
                        this.sfxSounds.set(key, audio);
                    }
                    
                    console.log(`Audio loaded: ${key}`);
                    resolve(audio);
                };
                
                audio.onerror = () => {
                    reject(new Error(`Failed to load audio: ${url}`));
                };
                
                audio.src = url;
            });
        } catch (error) {
            console.error(`Error loading audio ${key}:`, error);
            throw error;
        }
    }

    // 播放背景音乐
    playMusic(key, loop = true, fadeIn = false) {
        if (!this.initialized || this.muted) return;
        
        const audio = this.musicTracks.get(key);
        if (!audio) {
            console.warn(`Music not found: ${key}`);
            return;
        }
        
        // 停止当前音乐
        if (this.currentMusic && this.currentMusic !== audio) {
            this.stopMusic(fadeIn);
        }
        
        this.currentMusic = audio;
        audio.loop = loop;
        audio.volume = fadeIn ? 0 : this.musicVolume * this.masterVolume;
        
        try {
            audio.currentTime = 0;
            audio.play();
            
            // 淡入效果
            if (fadeIn) {
                this.fadeInMusic(audio);
            }
            
            console.log(`Playing music: ${key}`);
        } catch (error) {
            console.error(`Error playing music ${key}:`, error);
        }
    }

    // 停止背景音乐
    stopMusic(fadeOut = false) {
        if (!this.currentMusic) return;
        
        if (fadeOut) {
            this.fadeOutMusic(this.currentMusic);
        } else {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
        }
    }

    // 暂停背景音乐
    pauseMusic() {
        if (this.currentMusic && !this.currentMusic.paused) {
            this.currentMusic.pause();
        }
    }

    // 恢复背景音乐
    resumeMusic() {
        if (this.currentMusic && this.currentMusic.paused) {
            this.currentMusic.play();
        }
    }

    // 播放音效
    playSFX(key, volume = 1.0, pitch = 1.0) {
        if (!this.initialized || this.muted) return;
        
        let audio = this.getPooledAudio(key);
        if (!audio) {
            const originalAudio = this.sfxSounds.get(key);
            if (!originalAudio) {
                console.warn(`SFX not found: ${key}`);
                return;
            }
            audio = originalAudio.cloneNode();
        }
        
        audio.volume = volume * this.sfxVolume * this.masterVolume;
        audio.currentTime = 0;
        
        // 音调调整（如果支持）
        if (pitch !== 1.0 && audio.playbackRate !== undefined) {
            audio.playbackRate = pitch;
        }
        
        try {
            const playPromise = audio.play();
            
            if (playPromise) {
                playPromise.catch(error => {
                    console.error(`Error playing SFX ${key}:`, error);
                });
            }
            
            this.activeSounds.add(audio);
            
            // 播放结束后回收到池中
            audio.onended = () => {
                this.activeSounds.delete(audio);
                this.returnToPool(key, audio);
            };
            
        } catch (error) {
            console.error(`Error playing SFX ${key}:`, error);
        }
    }

    // 从音频池获取音频实例
    getPooledAudio(key) {
        if (!this.audioPool.has(key)) {
            this.audioPool.set(key, []);
        }
        
        const pool = this.audioPool.get(key);
        return pool.length > 0 ? pool.pop() : null;
    }

    // 将音频实例返回到池中
    returnToPool(key, audio) {
        if (!this.audioPool.has(key)) {
            this.audioPool.set(key, []);
        }
        
        const pool = this.audioPool.get(key);
        if (pool.length < this.maxPoolSize) {
            audio.currentTime = 0;
            audio.playbackRate = 1.0;
            pool.push(audio);
        }
    }

    // 音乐淡入
    fadeInMusic(audio, duration = 1000) {
        if (this.musicFading) return;
        
        this.musicFading = true;
        const startTime = Date.now();
        const targetVolume = this.musicVolume * this.masterVolume;
        
        const fade = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            audio.volume = progress * targetVolume;
            
            if (progress < 1) {
                requestAnimationFrame(fade);
            } else {
                this.musicFading = false;
            }
        };
        
        fade();
    }

    // 音乐淡出
    fadeOutMusic(audio, duration = 1000) {
        if (this.musicFading) return;
        
        this.musicFading = true;
        const startTime = Date.now();
        const startVolume = audio.volume;
        
        const fade = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            audio.volume = startVolume * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(fade);
            } else {
                audio.pause();
                audio.currentTime = 0;
                this.currentMusic = null;
                this.musicFading = false;
            }
        };
        
        fade();
    }

    // 设置主音量
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        if (this.masterGain) {
            this.masterGain.gain.value = this.masterVolume;
        }
        
        // 更新当前播放的音乐音量
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume * this.masterVolume;
        }
    }

    // 设置音乐音量
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume * this.masterVolume;
        }
    }

    // 设置音效音量
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    // 静音/取消静音
    setMuted(muted) {
        this.muted = muted;
        
        if (muted) {
            this.pauseMusic();
            this.stopAllSFX();
        } else {
            this.resumeMusic();
        }
    }

    // 停止所有音效
    stopAllSFX() {
        this.activeSounds.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.activeSounds.clear();
    }

    // 停止所有音频
    stopAll() {
        this.stopMusic();
        this.stopAllSFX();
    }

    // 获取音量设置
    getVolumeSettings() {
        return {
            master: this.masterVolume,
            music: this.musicVolume,
            sfx: this.sfxVolume,
            muted: this.muted
        };
    }

    // 检查音频是否正在播放
    isMusicPlaying() {
        return this.currentMusic && !this.currentMusic.paused;
    }

    // 获取当前音乐信息
    getCurrentMusicInfo() {
        if (!this.currentMusic) return null;
        
        return {
            duration: this.currentMusic.duration,
            currentTime: this.currentMusic.currentTime,
            volume: this.currentMusic.volume,
            loop: this.currentMusic.loop,
            paused: this.currentMusic.paused
        };
    }

    // 预加载音频资源
    async preloadAudio(audioList) {
        const promises = audioList.map(audio => {
            return this.loadAudio(audio.url, audio.key, audio.type);
        });
        
        try {
            await Promise.all(promises);
            console.log('Audio preloading completed');
        } catch (error) {
            console.error('Audio preloading failed:', error);
        }
    }

    // 清理资源
    cleanup() {
        this.stopAll();
        
        this.musicTracks.clear();
        this.sfxSounds.clear();
        this.activeSounds.clear();
        this.audioPool.clear();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.initialized = false;
        console.log('Audio system cleaned up');
    }

    // 调试信息
    debug() {
        console.log('Audio Manager Debug Info:');
        console.log(`  Initialized: ${this.initialized}`);
        console.log(`  Unlocked: ${this.unlocked}`);
        console.log(`  Muted: ${this.muted}`);
        console.log(`  Music Tracks: ${this.musicTracks.size}`);
        console.log(`  SFX Sounds: ${this.sfxSounds.size}`);
        console.log(`  Active Sounds: ${this.activeSounds.size}`);
        console.log(`  Current Music: ${this.currentMusic ? 'Playing' : 'None'}`);
        console.log(`  Volumes: Master=${this.masterVolume}, Music=${this.musicVolume}, SFX=${this.sfxVolume}`);
    }
}

