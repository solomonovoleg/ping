/** Доменный тип комментария к посту (клиент). */
export type CommentItem = {
  id: string;
  postId: string;
  userId?: string;
  /** Публичный id для URL профиля `/u/{publicId}` */
  publicId?: number | null;
  text: string;
  createdAt: string;
  user: string;
  avatar: string | null;
  parentCommentId?: string | null;
  parentAuthorName?: string | null;
  parentText?: string | null;
  likes: number;
  /** Лайк текущего пользователя (если не авторизован — всегда false с сервера). */
  likedByMe?: boolean;
};

/** Строка списка с локальным временем и оптимистичным лайком. */
export type DisplayComment = CommentItem & {
  time: string;
  isLiked: boolean;
  displayLikes: number;
};
