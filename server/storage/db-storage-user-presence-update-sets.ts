export function userLastSeenUpdateSet(at: Date) {
  return { lastSeenAt: at } as const;
}

export function userFcmTokenUpdateSet(token: string | null) {
  return { fcmToken: token } as const;
}

export function userIosVoipTokenUpdateSet(token: string | null) {
  return { iosVoipToken: token } as const;
}
