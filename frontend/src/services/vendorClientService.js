import apiClient from './apiClient'; export default {list:async()=> (await apiClient.get('/vendor/clients')).data,detail:async companyId=>(await apiClient.get(`/vendor/clients/${companyId}`)).data};
