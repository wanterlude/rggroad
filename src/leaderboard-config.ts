/**
 * Firebase Realtime Database URL.
 *
 * Paste the URL from Firebase Console → Realtime Database (top of the page),
 * for example: "https://rggroad-default-rtdb.europe-west1.firebasedatabase.app".
 * The URL is public; access is controlled by Database Rules, not this file.
 */
export const FIREBASE_DB_URL =
  "https://rgg-road-default-rtdb.asia-southeast1.firebasedatabase.app";

/**
 * Рейтинг на VPS (wanterlude.ru). Основная база: читаем и пишем сюда.
 * Firebase остаётся второй, резервной базой — туда результат уходит тоже.
 */
export const LEADERBOARD_API = "/api/scores.php";
