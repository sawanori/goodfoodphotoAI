import { Request, Response, NextFunction } from 'express';
import { firebaseAdmin } from '../firebase';

// Requestオブジェクトを拡張してuserプロパティを追加
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string | undefined;
      };
    }
  }
}

/**
 * Firebase ID token検証ミドルウェア
 *
 * Authorizationヘッダーから Bearer tokenを抽出し、
 * Firebase Admin SDKで検証する。
 *
 * 成功時: req.userにユーザー情報をアタッチしてnext()
 * 失敗時: 401 UNAUTHORIZEDレスポンスを返す
 */
export async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Authorizationヘッダーの取得
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);

    if (!match) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization headerが見つからないか、形式が不正です',
          retryable: false,
        },
      });
      return;
    }

    const idToken = match[1];

    // Firebase ID tokenの検証
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

    // ユーザー情報をrequestオブジェクトにアタッチ
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    // 次のミドルウェアまたはハンドラーへ
    next();
  } catch (error: any) {
    console.error('Token verification failed:', error);

    // エラーの種類に応じたレスポンス
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: '認証トークンが期限切れです。再ログインしてください',
          retryable: false,
        },
      });
      return;
    }

    if (error.code === 'auth/argument-error') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: '認証トークンの形式が不正です',
          retryable: false,
        },
      });
      return;
    }

    // その他のエラー
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: '認証に失敗しました',
        retryable: false,
      },
    });
  }
}
