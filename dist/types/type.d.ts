export interface NotificationContent {
    timestamp: number | string | Date;
    event: string;
    message: any;
}
export interface EventCacheType {
    SET_DATA: string;
    GET_DATA: string;
    DELETE_DATA: string;
    HAS_KEY: string;
    RETURN_SET_DATA: string;
    RETURN_GET_DATA: string;
    RETURN_DELETE_DATA: string;
    RETURN_HAS_KEY: string;
    RETURN_ERROR: string;
}
export interface EventMessageCache {
    fromIPC: string;
    forIPC?: string;
    key: string | number;
    value?: any;
    expireInSeconds?: number;
}
//# sourceMappingURL=type.d.ts.map