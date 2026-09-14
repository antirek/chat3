/** Map Mongo/AMQP update document → gRPC Update message. */
export function convertToGrpcUpdate(update: any): any {
  return {
    update_id: update._id?.toString() || update.update_id || update.updateId || '',
    tenant_id: update.tenantId || update.tenant_id || '',
    user_id: update.userId || update.user_id || '',
    entity_id: update.entityId?.toString() || update.entity_id || '',
    event_id: update.eventId || update.event_id || '',
    source_event_type: update.sourceEventType || update.source_event_type || update.eventType || '',
    update_type: update.updateType || update.update_type || '',
    data: update.data || {},
    created_at: update.createdAt || update.created_at || 0
  };
}
