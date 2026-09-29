import {pool,workflowSchema} from './database.mjs'
import {createWorkflowData} from './workflow-data-store.mjs'
export const {getCampaigns,getCampaignContacts,getConversations,getConversationEmail,getFollowups,getCreatives,getJobs,getOptouts}=createWorkflowData({pool,schema:workflowSchema,productId:'ficharia'})
