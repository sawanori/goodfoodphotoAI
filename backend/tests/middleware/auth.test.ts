import { Request, Response } from 'express';
import { verifyAuth } from '../../src/middleware/auth';
import { firebaseAdmin } from '../../src/firebase';

// Firebase Admin SDKをモック
jest.mock('../../src/firebase', () => ({
  firebaseAdmin: {
    auth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
    }),
  },
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  it('should pass with valid token', async () => {
    // モックの設定
    mockRequest.headers = {
      authorization: 'Bearer valid-token',
    };

    const mockDecodedToken = {
      uid: 'test-user-123',
      email: 'test@example.com',
    };

    (firebaseAdmin.auth().verifyIdToken as jest.Mock).mockResolvedValue(
      mockDecodedToken
    );

    // ミドルウェアを実行
    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    // 検証
    expect(mockRequest.user).toEqual({
      uid: 'test-user-123',
      email: 'test@example.com',
    });
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should reject missing Authorization header', async () => {
    mockRequest.headers = {};

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject malformed Authorization header', async () => {
    mockRequest.headers = {
      authorization: 'InvalidFormat token',
    };

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject expired token', async () => {
    mockRequest.headers = {
      authorization: 'Bearer expired-token',
    };

    const expiredError: any = new Error('Token expired');
    expiredError.code = 'auth/id-token-expired';

    (firebaseAdmin.auth().verifyIdToken as jest.Mock).mockRejectedValue(
      expiredError
    );

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'TOKEN_EXPIRED',
      }),
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should reject invalid token', async () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token',
    };

    (firebaseAdmin.auth().verifyIdToken as jest.Mock).mockRejectedValue(
      new Error('Invalid token')
    );

    await verifyAuth(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
