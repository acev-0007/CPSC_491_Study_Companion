import {
  SupabaseDocumentStore,
} from "./supabaseDocumentStore.js";


export class DocumentContentService {
  constructor(accessToken) {
    this.store =
      new SupabaseDocumentStore(
        accessToken
      );
  }


  async getDocumentContent(
    documentId,
    userId
  ) {
    const document =
      await this.store.getForUser(
        documentId,
        userId
      );

    if (!document) {
      return null;
    }

    return {
      documentId:
        document.id,

      name:
        document.name,

      status:
        document.status,

      text:
        document.extractedText,

      textLength:
        document.textLength,
    };
  }


  async getDocumentChunks(
    documentId,
    userId
  ) {
    const document =
      await this.store.getForUser(
        documentId,
        userId
      );

    if (!document) {
      return null;
    }

    const chunks =
      await this.store
        .listChunksForDocument(
          documentId
        );

    return {
      documentId:
        document.id,

      name:
        document.name,

      status:
        document.status,

      chunks,
    };
  }


  async getAiReadyContent(
    documentId,
    userId
  ) {
    const document =
      await this.store.getForUser(
        documentId,
        userId
      );

    if (!document) {
      return null;
    }

    if (
      document.status !==
      "ready"
    ) {
      return {
        documentId:
          document.id,

        name:
          document.name,

        status:
          document.status,

        text:
          null,

        chunks: [],
      };
    }

    const chunks =
      await this.store
        .listChunksForDocument(
          documentId
        );

    return {
      documentId:
        document.id,

      name:
        document.name,

      status:
        document.status,

      text:
        document.extractedText,

      chunks,
    };
  }
}