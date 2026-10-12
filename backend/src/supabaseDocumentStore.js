import {
  createUserSupabaseClient,
} from "./config/supabase.js";


function toDatabaseDocument(document) {
  return {
    id: document.id,
    user_id: document.userId,

    name: document.name,
    type: document.type,
    mime_type: document.mimeType,
    size: document.size,

    category: document.category,
    course: document.course,

    status: document.status,
    extraction_error: document.extractionError,

    text_length: document.textLength,
    extracted_text: document.extractedText,

    stored_filename: document.storedFilename,

    created_at: document.uploadedAt,
  };
}


function fromDatabaseDocument(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,

    name: row.name,
    type: row.type,
    mimeType: row.mime_type,
    size: row.size,

    category: row.category,
    course: row.course,

    uploadedAt: row.created_at,

    status: row.status,
    extractionError: row.extraction_error,

    textLength: row.text_length,
    storedFilename: row.stored_filename,
    extractedText: row.extracted_text,
  };
}


export class SupabaseDocumentStore {
  constructor(accessToken) {
    this.supabase =
      createUserSupabaseClient(
        accessToken
      );
  }


  async add(document) {
    const databaseDocument =
      toDatabaseDocument(document);

    const {
      data,
      error,
    } = await this.supabase
      .from("documents")
      .insert(databaseDocument)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return fromDatabaseDocument(data);
  }


  async listForUser(userId) {
    const {
      data,
      error,
    } = await this.supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .order(
        "created_at",
        { ascending: false }
      );

    if (error) {
      throw error;
    }

    return (data || []).map(
      fromDatabaseDocument
    );
  }


  async updateForUser(
    id,
    userId,
    updates
  ) {
    const databaseUpdates = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      updates.name !== undefined &&
      updates.name !== ""
    ) {
      databaseUpdates.name =
        updates.name;
    }

    if (
      updates.category !== undefined &&
      updates.category !== ""
    ) {
      databaseUpdates.category =
        updates.category;
    }

    if (updates.course !== undefined) {
      databaseUpdates.course =
        updates.course ||
        "Unassigned";
    }

    const {
      data,
      error,
    } = await this.supabase
      .from("documents")
      .update(databaseUpdates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return fromDatabaseDocument(data);
  }


  async deleteForUser(
    id,
    userId
  ) {
    const {
      data,
      error,
    } = await this.supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return fromDatabaseDocument(data);
  }





  async replaceChunksForDocument(
    documentId,
    chunks
  ) {
    const {
      error: deleteError,
    } = await this.supabase
      .from("document_chunks")
      .delete()
      .eq(
        "document_id",
        documentId
      );

    if (deleteError) {
      throw deleteError;
    }

    if (!chunks.length) {
      return [];
    }

    const rows =
      chunks.map(
        (chunk) => ({
          document_id:
            documentId,

          chunk_index:
            chunk.chunkIndex,

          content:
            chunk.content,

          start_offset:
            chunk.startOffset,

          end_offset:
            chunk.endOffset,
        })
      );

    const {
      data,
      error,
    } = await this.supabase
      .from("document_chunks")
      .insert(rows)
      .select();

    if (error) {
      throw error;
    }

    return data || [];
  }


  async listChunksForDocument(
    documentId
  ) {
    const {
      data,
      error,
    } = await this.supabase
      .from("document_chunks")
      .select("*")
      .eq(
        "document_id",
        documentId
      )
      .order(
        "chunk_index",
        {
          ascending: true,
        }
      );

    if (error) {
      throw error;
    }

    return (data || []).map(
      (row) => ({
        id: row.id,

        documentId:
          row.document_id,

        chunkIndex:
          row.chunk_index,

        content:
          row.content,

        startOffset:
          row.start_offset,

        endOffset:
          row.end_offset,
      })
    );
  }
  



  async getForUser(
    id,
    userId
  ) {
    const {
      data,
      error,
    } = await this.supabase
      .from("documents")
      .select("*")
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return fromDatabaseDocument(
      data
    );
  }
}
