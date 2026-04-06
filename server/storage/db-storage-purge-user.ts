import type { PoolClient } from "pg";

/** Не критичные шаги: таблицы могли не быть созданы на старых БД. */
async function tryQuery(client: PoolClient, text: string, params: string[]): Promise<void> {
  try {
    await client.query(text, params);
  } catch {
    /* 42P01 undefined_table и др. — пропускаем */
  }
}

/**
 * Удаление пользователя из БД в одной транзакции.
 * Сессии (connect-pg-simple) чистим мягко: ошибка формата sess не должна откатывать DELETE users.
 */
export async function runDbUserPurgeTransaction(client: PoolClient, userId: string): Promise<boolean> {
  try {
    await client.query("BEGIN");

    await client.query(`UPDATE users SET invited_by_id = NULL WHERE invited_by_id = $1`, [userId]);
    await client.query(`UPDATE users SET banned_by = NULL WHERE banned_by = $1`, [userId]);
    await client.query(`UPDATE users SET studio_created_by_admin_id = NULL WHERE studio_created_by_admin_id = $1`, [
      userId,
    ]);

    await client.query(`DELETE FROM referral_codes WHERE inviter_user_id = $1`, [userId]);

    await tryQuery(
      client,
      `UPDATE invite_more_requests SET reviewed_by_user_id = NULL WHERE reviewed_by_user_id = $1`,
      [userId],
    );
    await tryQuery(client, `DELETE FROM invite_more_requests WHERE user_id = $1`, [userId]);

    await tryQuery(client, `DELETE FROM referral_auto_grants WHERE user_id = $1`, [userId]);
    await tryQuery(client, `DELETE FROM ai_chat_messages WHERE user_id = $1`, [userId]);

    try {
      await client.query(`DELETE FROM "session" WHERE sess::jsonb->>'userId' = $1`, [userId]);
    } catch {
      try {
        await client.query(`DELETE FROM "session" WHERE sess::text LIKE $1`, [`%"userId":"${userId}"%`]);
      } catch {
        /* sess без jsonb / другой движок сессий — не блокируем purge */
      }
    }

    const del = await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query("COMMIT");
    return (del.rowCount ?? 0) > 0;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    throw e;
  }
}
