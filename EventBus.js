/**
 * 事件总线 - 用于游戏中的事件通信
 */
class EventBus {
    constructor() {
        this.events = new Map();
    }

    // 注册事件监听器
    on(eventName, callback, context = null) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        this.events.get(eventName).push({
            callback,
            context,
            once: false
        });
    }

    // 注册一次性事件监听器
    once(eventName, callback, context = null) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        this.events.get(eventName).push({
            callback,
            context,
            once: true
        });
    }

    // 移除事件监听器
    off(eventName, callback = null, context = null) {
        if (!this.events.has(eventName)) {
            return;
        }

        const listeners = this.events.get(eventName);
        
        if (callback === null) {
            // 移除所有监听器
            this.events.delete(eventName);
        } else {
            // 移除特定监听器
            const filteredListeners = listeners.filter(listener => {
                return !(listener.callback === callback && 
                        (context === null || listener.context === context));
            });
            
            if (filteredListeners.length === 0) {
                this.events.delete(eventName);
            } else {
                this.events.set(eventName, filteredListeners);
            }
        }
    }

    // 触发事件
    emit(eventName, ...args) {
        if (!this.events.has(eventName)) {
            return;
        }

        const listeners = this.events.get(eventName).slice(); // 创建副本避免修改问题
        const toRemove = [];

        listeners.forEach((listener, index) => {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, ...args);
                } else {
                    listener.callback(...args);
                }

                // 标记一次性监听器待移除
                if (listener.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                console.error(`Error in event listener for '${eventName}':`, error);
            }
        });

        // 移除一次性监听器
        if (toRemove.length > 0) {
            const remainingListeners = this.events.get(eventName).filter(
                listener => !toRemove.includes(listener)
            );
            
            if (remainingListeners.length === 0) {
                this.events.delete(eventName);
            } else {
                this.events.set(eventName, remainingListeners);
            }
        }
    }

    // 检查是否有特定事件的监听器
    hasListeners(eventName) {
        return this.events.has(eventName) && this.events.get(eventName).length > 0;
    }

    // 获取事件监听器数量
    getListenerCount(eventName) {
        return this.events.has(eventName) ? this.events.get(eventName).length : 0;
    }

    // 清除所有事件监听器
    clear() {
        this.events.clear();
    }

    // 获取所有事件名称
    getEventNames() {
        return Array.from(this.events.keys());
    }

    // 调试信息
    debug() {
        console.log('EventBus Debug Info:');
        this.events.forEach((listeners, eventName) => {
            console.log(`  ${eventName}: ${listeners.length} listeners`);
        });
    }
}

// 创建全局事件总线实例
const gameEventBus = new EventBus();

// 游戏事件常量
const GameEvents = {
    // 游戏状态事件
    GAME_START: 'game_start',
    GAME_PAUSE: 'game_pause',
    GAME_RESUME: 'game_resume',
    GAME_OVER: 'game_over',
    LEVEL_START: 'level_start',
    LEVEL_COMPLETE: 'level_complete',
    
    // 玩家事件
    PLAYER_SPAWN: 'player_spawn',
    PLAYER_DEATH: 'player_death',
    PLAYER_HURT: 'player_hurt',
    PLAYER_HEAL: 'player_heal',
    PLAYER_MOVE: 'player_move',
    PLAYER_JUMP: 'player_jump',
    PLAYER_SHOOT: 'player_shoot',
    
    // 武器事件
    WEAPON_PICKUP: 'weapon_pickup',
    WEAPON_SWITCH: 'weapon_switch',
    WEAPON_FIRE: 'weapon_fire',
    WEAPON_RELOAD: 'weapon_reload',
    
    // 敌人事件
    ENEMY_SPAWN: 'enemy_spawn',
    ENEMY_DEATH: 'enemy_death',
    ENEMY_HURT: 'enemy_hurt',
    ENEMY_ATTACK: 'enemy_attack',
    
    // 碰撞事件
    COLLISION_PLAYER_ENEMY: 'collision_player_enemy',
    COLLISION_BULLET_ENEMY: 'collision_bullet_enemy',
    COLLISION_PLAYER_POWERUP: 'collision_player_powerup',
    COLLISION_PLAYER_PLATFORM: 'collision_player_platform',
    
    // UI事件
    UI_UPDATE_HEALTH: 'ui_update_health',
    UI_UPDATE_SCORE: 'ui_update_score',
    UI_UPDATE_WEAPON: 'ui_update_weapon',
    UI_SHOW_MESSAGE: 'ui_show_message',
    
    // 音频事件
    AUDIO_PLAY_SFX: 'audio_play_sfx',
    AUDIO_PLAY_MUSIC: 'audio_play_music',
    AUDIO_STOP_MUSIC: 'audio_stop_music',
    
    // 输入事件
    INPUT_KEY_DOWN: 'input_key_down',
    INPUT_KEY_UP: 'input_key_up',
    INPUT_TOUCH_START: 'input_touch_start',
    INPUT_TOUCH_END: 'input_touch_end',
    
    // 系统事件
    RESOURCE_LOADED: 'resource_loaded',
    RESOURCE_ERROR: 'resource_error',
    FRAME_UPDATE: 'frame_update',
    PHYSICS_UPDATE: 'physics_update'
};

