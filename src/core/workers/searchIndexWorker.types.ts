export interface SearchDocument {
  id: string;
  text: string;
  conversationId: string;
  title?: string;
}

export type SearchWorkerRequest =
  | {
      id: number;
      action: 'INIT';
      payload: { serializedIndex?: string | null };
    }
  | {
      id: number;
      action: 'BUILD_FULL_INDEX';
      payload: { documents: SearchDocument[] };
    }
  | {
      id: number;
      action: 'UPSERT';
      payload: { documents: SearchDocument[] };
    }
  | {
      id: number;
      action: 'REMOVE';
      payload: { documentIds: string[] };
    }
  | {
      id: number;
      action: 'SEARCH';
      payload: { query: string };
    };

export type SearchWorkerSuccessResponse =
  | {
      id: number;
      action: 'INIT';
      success: true;
      result: { ready: true };
    }
  | {
      id: number;
      action: 'BUILD_FULL_INDEX';
      success: true;
      result: { serializedIndex: string };
    }
  | {
      id: number;
      action: 'UPSERT';
      success: true;
      result: { serializedIndex: string };
    }
  | {
      id: number;
      action: 'REMOVE';
      success: true;
      result: { serializedIndex: string };
    }
  | {
      id: number;
      action: 'SEARCH';
      success: true;
      result: { conversationIds: string[] };
    };

export interface SearchWorkerErrorResponse {
  id: number;
  success: false;
  error: string;
}

export type SearchWorkerResponse =
  | SearchWorkerSuccessResponse
  | SearchWorkerErrorResponse;
