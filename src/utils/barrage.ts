/**
 * 弹幕相关工具函数
 */

import type { DouyinUser } from '@/types'

/**
 * 判断用户是否有亮灯状态的灯牌（粉丝团徽章）
 * 
 * 亮灯用户数据结构：
 * ```
 * fansClub: {
 *   data: {
 *     level: 3,              // 灯牌等级 > 0
 *     userFansClubStatus: 1, // 1 = 亮灯（活跃）
 *     badge: { ... },
 *     anchorId: "xxx"
 *   }
 * }
 * ```
 * 
 * 灭灯用户数据结构：
 * ```
 * fansClub: {
 *   data: {
 *     level: 3,              // 仍有等级
 *     userFansClubStatus: 2, // 2 = 灭灯（非活跃，灰色灯牌）
 *     badge: { icons: { "2": { uri: "lightdown_3.png" } } }
 *   }
 * }
 * ```
 * 
 * 无灯牌数据结构：
 * ```
 * fansClub: {
 *   data: {
 *     badge: { icons: { "0": {} } }
 *   }
 * }
 * ```
 * 
 * @param user 用户对象（来自弹幕数据的 user 字段）
 * @returns 是否有亮灯状态的灯牌（严格模式：level > 0 且 userFansClubStatus === 1）
 */
export function hasUserBadge(user: DouyinUser | null | undefined): boolean {
    if (!user) return false

    const data = user.fansClub?.data
    const level = data?.level
    const status = data?.userFansClubStatus

    // 严格模式：必须有等级且状态为亮灯(1)
    return typeof level === 'number' && level > 0 && status === 1
}

/**
 * 获取用户灯牌等级
 * @param user 用户对象
 * @returns 灯牌等级，无灯牌返回 0
 */
export function getUserBadgeLevel(user: DouyinUser | null | undefined): number {
    if (!user) return 0
    return user.fansClub?.data?.level ?? 0
}

