let currentDate = new Date();
let year = currentDate.getFullYear();
let month = currentDate.getMonth()+1;
month = month > 9 ? month : '0' + month;
let date = currentDate.getDate();
date = date > 9 ? date : '0' + date;
var filter = {
    beginTime: year+'-'+month+'-01',
    endTime: year+'-'+month+'-'+date
};

var report = {
  title: 'Заполните данные для отчёта'
};

var vm = new Vue ({
    el: '#app',
    data: {
        filter: filter,
        report: report
    },
    methods: {
        createReport: function (event) {
            event.preventDefault();
            this.report.title = 'Отчёт строится...';
            this.getCallsData(this.filter.beginTime,this.filter.endTime);
        },
        resize : function () {
            BX24.resizeWindow(frames.innerWidth,window.innerHeight);
        },
        getCallsData: function (filterBeginTime,filterEndTime) {
            let callToContactsStats=[];
            let callToCompaniesStats=[];
            BX24.callMethod(
                'voximplant.statistic.get',
                {
                    "FILTER": {
                        ">CALL_START_DATE":filterBeginTime,
                        "<CALL_START_DATE":filterEndTime,
                        'CALL_FAILED_CODE':'200',
                        'CRM_ENTITY_TYPE':['CONTACT','COMPANY'],
                        ">CRM_ACTIVITY_ID":"0"
                    },
                    "SORT": "CALL_START_DATE",
                    'ORDER':'DESC'
                },
                function(result){
                    result.data().forEach(function(call,i){
                        if (call.CRM_ENTITY_TYPE==='CONTACT')
                        {
                            call.CONTACT_ID=call.CRM_ENTITY_ID;
                            call.WITHOUT_COMPANY=true;
                            callToContactsStats.push(call);
                        }
                        else if (call.CRM_ENTITY_TYPE==='COMPANY')
                        {
                            callToCompaniesStats.push(call);
                        }
                    });
                    if (result.more()){
                        result.next();
                    } else {
                        vm.getContacts(callToContactsStats,callToCompaniesStats);
                    }
                });
        },
        getContacts: function (callToContactsStats,callToCompaniesStats){
            let contactList=[];
            callToContactsStats.forEach(function (call,i) {
                if (!~contactList.indexOf(call.CRM_ENTITY_ID)) {
                    contactList.push(call.CRM_ENTITY_ID);
                }
            });
            vm.getContactsCompanies(contactList,callToContactsStats,callToCompaniesStats,1);
        },
        getContactsCompanies: function (contactList,callToContactsStats,callToCompaniesStats,i){
            let request=[];
            if (i*50<contactList.length)
            {
                for (let j=i*50-50;j<i*50;j++){
                    request[j]=["crm.contact.company.items.get",
                        {
                            id:contactList[j]
                        }
                    ];
                }
                BX24.callBatch(
                    request,
                    function(result)
                    {
                        result.forEach(function (res,i) {
                            if (res.answer.result.length>0){
                                callToContactsStats.forEach(function (call) {
                                    if (res.query.data.match(/\d+/g)[0]==call.CRM_ENTITY_ID)
                                    {
                                        call.CRM_ENTITY_ID=res.answer.result[0].COMPANY_ID+'';
                                        call.WITHOUT_COMPANY=false;
                                        callToCompaniesStats.push(call);
                                    }
                                });
                            }
                        });
                        i++;
                        vm.getContactsCompanies(contactList,callToContactsStats,callToCompaniesStats,i);
                    });
            }
            else if (i*50-contactList.length<50)
            {
                for (let j=i*50-50;j<contactList.length;j++){
                    request[j]=["crm.contact.company.items.get",
                        {
                            id:contactList[j]
                        }
                    ];
                }
                BX24.callBatch(
                    request,
                    function(result)
                    {
                        result.forEach(function (res,i) {
                            if (res.answer.result.length>0){
                                callToContactsStats.forEach(function (call) {
                                    if (res.query.data.match(/\d+/g)[0]==call.CRM_ENTITY_ID)
                                    {
                                        call.CRM_ENTITY_ID=res.answer.result[0].COMPANY_ID;
                                        call.WITHOUT_COMPANY=false;
                                        callToCompaniesStats.push(call);
                                    }
                                });
                            }
                        });
                        i++;
                        vm.getContactsCompanies(contactList,callToContactsStats,callToCompaniesStats,i);
                    }
                );
            }
            else
            {
                vm.getContactsWithoutCompaniesAndCallStats(callToCompaniesStats,callToContactsStats);
            }
        },
        getContactsWithoutCompaniesAndCallStats: function (callToCompaniesStats,callToContactsStats){
            let contactsWithoutCompaniesIDs=[];
            callToContactsStats.forEach(function (call) {
               if (call.WITHOUT_COMPANY===true)
               {
                   contactsWithoutCompaniesIDs.push(call.CONTACT_ID);
                   callToCompaniesStats.push(call);
               }
            });
            vm.getContactsFIO(callToCompaniesStats,contactsWithoutCompaniesIDs);
        },
        getContactsFIO: function(callToCompaniesStats,contactsWithoutCompaniesIDs){
            BX24.callMethod(
                "crm.contact.list",
                {
                    filter: { "ID": contactsWithoutCompaniesIDs },
                    select: [ "ID", "NAME", "LAST_NAME" ]
                },
                function(result)
                {
                    result.data().forEach(function (contact) {
                        callToCompaniesStats.forEach(function (call) {
                            if (call.CRM_ENTITY_ID==contact.ID){
                                call.COMPANY_TITLE=contact.NAME+' '+contact.LAST_NAME;
                            }
                        });
                    });
                    if(result.more())
                    {
                        result.next();
                    }
                    else
                    {
                        vm.getCompanyList(callToCompaniesStats);
                    }
                }
            );
        },
        getCompanyList: function(callToCompaniesStats){
            let companyList=[];
            callToCompaniesStats.forEach(function (call,i) {
                if (call.WITHOUT_COMPANY!==true)
                {
                    if (!~companyList.indexOf(call.CRM_ENTITY_ID)) {
                        companyList.push(call.CRM_ENTITY_ID);
                    }
                }
                call.HAS_NEXT=false;
                call.MAIN_ROW=true;
            });
            vm.getUsersLastNames(companyList,callToCompaniesStats);
        },
        getUsersLastNames: function(companyList,callToCompaniesStats){
            let usersData=[];
            BX24.callMethod(
                'user.search',
                {},
                function(result){
                    result.data().forEach(function(user){
                        usersData.push(user);
                    });
                    if (result.more()){
                        result.next();
                    } else {
                        vm.defineUsersInStats(usersData,companyList,callToCompaniesStats);
                    }
                });

        },
        defineUsersInStats:function(usersData,companyList,callToCompaniesStats){
            callToCompaniesStats.forEach(function (stat) {
                usersData.forEach(function (user) {
                    if (stat.PORTAL_USER_ID===user.ID)
                    {
                        stat.RESPONSIBLE=user.LAST_NAME+' '+user.NAME;
                    }
                });
            });
            vm.getCompaniesTitles(companyList,callToCompaniesStats);
        },
        getCompaniesTitles: function(companyList,callToCompaniesStats){
            BX24.callMethod(
                "crm.company.list",
                {
                    filter: { "ID": companyList },
                    select: [ "ID", "TITLE" ]
                },
                function(result)
                {
                    result.data().forEach(function (company) {
                        callToCompaniesStats.forEach(function (call) {
                            if (call.CRM_ENTITY_ID==company.ID&&call.WITHOUT_COMPANY!==true){
                                call.COMPANY_TITLE=company.TITLE;
                            }
                        });
                    });
                    if(result.more())
                    {
                        result.next();
                    }
                    else
                    {
                        vm.getNextActivitiesForCompanies(companyList,callToCompaniesStats,1);
                    }
                }
            );
        },
        getNextActivitiesForCompanies: function (companyList,callToCompaniesStats,i) {
            let request=[];
            if (i*50<companyList.length)
            {
                for (let j=i*50-50;j<i*50;j++){
                    request[j]=["crm.activity.list",
                        {
                            order:{ "ID": "DESC" },
                            filter:
                            {
                                "OWNER_ID": companyList[j],
                                ">END_TIME":this.filter.endTime,
                                "TYPE_ID":2
                            },
                            select:[ "OWNER_ID","END_TIME" ]
                        }];
                }
                BX24.callBatch(
                    request,
                    function(result)
                    {
                        result.forEach(function (res,i) {
                            if (res.answer.total>0) {
                                callToCompaniesStats.forEach(function (call,i) {
                                    if (call.CRM_ENTITY_ID==res.answer.result[0].OWNER_ID&&call.WITHOUT_COMPANY!==true)
                                    {
                                        call.HAS_NEXT=true;
                                        call.NEXT_CALL_DATE=res.answer.result[0].END_TIME;
                                    }
                                });

                            }
                        });
                        i++;
                        vm.getNextActivitiesForCompanies(companyList,callToCompaniesStats,i);
                    }
                );
            }
            else if (i*50-companyList.length<50)
            {
                for (let j=i*50-50;j<companyList.length;j++){
                    request[j]=["crm.activity.list",
                        {
                            order:{ "ID": "DESC" },
                            filter:
                                {
                                    "OWNER_ID": companyList[j],
                                    ">END_TIME":this.filter.endTime,
                                    "TYPE_ID":2
                                },
                            select:[ "OWNER_ID" ,"END_TIME" ]
                        }];
                }
                BX24.callBatch(
                    request,
                    function(result)
                    {
                        result.forEach(function (res,i) {
                            if (res.answer.total>0) {
                                callToCompaniesStats.forEach(function (call,i) {
                                    if (call.CRM_ENTITY_ID==res.answer.result[0].OWNER_ID&&call.WITHOUT_COMPANY!==true)
                                    {
                                        call.HAS_NEXT=true;
                                        call.NEXT_CALL_DATE=res.answer.result[0].END_TIME;
                                    }
                                });

                            }
                        });
                        i++;
                        vm.getNextActivitiesForCompanies(companyList,callToCompaniesStats,i);
                    }
                );
            }
            else
            {
                vm.getAllContactsForCompanies(companyList,callToCompaniesStats,1);
            }
        },
        getAllContactsForCompanies: function(companyList,callToCompaniesStats,i){
            let request=[];
            if (typeof contactsIDs==="undefined")
            {
                contactsIDs=[];
                contactsInfo=[];
            }
            if (i*50<companyList.length)
            {
                for (let j=i*50-50;j<i*50;j++){
                    request[j]=["crm.company.contact.items.get",
                        {
                            id:companyList[j]
                        }];
                }
                BX24.callBatch(
                    request,
                    function(result)
                    {
                        result.forEach(function (res,i) {
                            if (res.answer.result.length>0) {
                                res.answer.result.forEach(function (contact,i) {
                                    contactsIDs.push(contact.CONTACT_ID);
                                    contactsInfo[contact.CONTACT_ID]=[];
                                    contactsInfo[contact.CONTACT_ID].push(res.query.data.split('=')[1]);
                                });
                            }
                        });
                        i++;
                        vm.getAllContactsForCompanies(companyList,callToCompaniesStats,i);
                    }
                );
            }
            else if (i*50-companyList.length<50)
            {
                for (let j=i*50-50;j<i*50;j++){
                    request[j]=["crm.company.contact.items.get",
                        {
                            id:companyList[j]
                        }];
                }
                BX24.callBatch(
                    request,
                    function(result)
                    {
                        result.forEach(function (res,i) {
                            if (res.answer.result.length>0) {
                                res.answer.result.forEach(function (contact,i) {
                                    contactsIDs.push(contact.CONTACT_ID);
                                    contactsInfo[contact.CONTACT_ID]=[];
                                    contactsInfo[contact.CONTACT_ID].push(res.query.data.split('=')[1]);
                                });

                            }
                        });
                        i++;
                        vm.getAllContactsForCompanies(companyList,callToCompaniesStats,i);
                    }
                );
            }
            else
            {
                vm.moveIDsFromCallsToContactsWithoutCompaniesToContactsIDs(companyList,callToCompaniesStats,contactsIDs,contactsInfo);
            }
        },
        moveIDsFromCallsToContactsWithoutCompaniesToContactsIDs: function(companyList,callToCompaniesStats,contactsIDs,contactsInfo){
            callToCompaniesStats.forEach(function (call) {
                if(call.WITHOUT_COMPANY===true)
                {
                    contactsIDs.push(call.CRM_ENTITY_ID);
                }
            });
            vm.getCallsBeforePeriodForContacts(companyList,callToCompaniesStats,contactsIDs,contactsInfo);
        },
        getCallsBeforePeriodForContacts:function(companyList,callToCompaniesStats,contactsIDs,contactsInfo){
            let callToContactsStats=[];
            BX24.callMethod(
                'voximplant.statistic.get',
                {
                    "FILTER": {
                        "<CALL_START_DATE":vm.filter.beginTime,
                        'CALL_FAILED_CODE':'200',
                        'CRM_ENTITY_TYPE':'CONTACT',
                        'CRM_ENTITY_ID':contactsIDs
                    },
                    "SORT": "CRM_ENTITY_ID",
                    'ORDER':'DESC'
                },
                function(result){
                    result.data().forEach(function(call,i){
                        callToContactsStats.push(call);
                    });
                    if (result.more()){
                        result.next();
                    } else {
                        vm.groupCallsByContacts(companyList,callToCompaniesStats,callToContactsStats,contactsInfo);
                    }
                });
        },
        groupCallsByContacts: function(companyList,callToCompaniesStats,callToContactsStats,contactsInfo){
            let groupedContactCalls=[];
            for (let i=0;i<callToContactsStats.length;i++){
                if (groupedContactCalls[callToContactsStats[i].CRM_ENTITY_ID]===undefined){
                    groupedContactCalls[callToContactsStats[i].CRM_ENTITY_ID]=[];
                }
                groupedContactCalls[callToContactsStats[i].CRM_ENTITY_ID].push(callToContactsStats[i]);
            }
            vm.getLastContactCallsBeforePeriod(companyList,callToCompaniesStats,groupedContactCalls,contactsInfo);
        },
        getLastContactCallsBeforePeriod: function(companyList,callToCompaniesStats,groupedContactCalls,contactsInfo){
            let filteredCalls=[];
            groupedContactCalls.forEach(function (group) {
                if (group.length===1)
                {
                    filteredCalls.push(group[0])
                }
                else 
                {
                    let max = group[0].ID;
                    group.forEach(function (call) {
                        if (max<call.ID)
                        {
                            max=call.ID;
                        }
                    });
                    group.forEach(function (call) {
                        if (max===call.ID)
                        {
                            filteredCalls.push(call);
                        }
                    });
                }
            });
            vm.moveContactCallsToCompaniesStats(companyList,callToCompaniesStats,filteredCalls,contactsInfo);
        },
        moveContactCallsToCompaniesStats: function(companyList,callToCompaniesStats,filteredCalls,contactsInfo){
            contactsInfo.forEach(function (companyID,contactID) {
                filteredCalls.forEach(function (call) {
                    if (call.CRM_ENTITY_ID==contactID){
                        callToCompaniesStats.forEach(function (callToCompany) {
                            if (callToCompany.CRM_ENTITY_ID==companyID){
                                callToCompany.BEFORE_CALL_DATE=call.CALL_START_DATE;
                            }
                        });
                    }
                });
            });
            callToCompaniesStats.forEach(function (callToCompany) {
                if (callToCompany.WITHOUT_COMPANY===true)
                {
                    filteredCalls.forEach(function (call) {
                        if (callToCompany.CRM_ENTITY_ID==call.CRM_ENTITY_ID)
                        {
                            callToCompany.BEFORE_CALL_DATE=call.CALL_START_DATE;
                        }
                    });
                }
            });
            vm.getCallsBeforePeriodForCompanies(companyList,callToCompaniesStats);
        },
        getCallsBeforePeriodForCompanies:function(companyList,callToCompaniesStats){
            let oldCallsToCompanies=[];
            BX24.callMethod(
                'voximplant.statistic.get',
                {
                    "FILTER": {
                        "<CALL_START_DATE":vm.filter.beginTime,
                        'CALL_FAILED_CODE':'200',
                        'CRM_ENTITY_TYPE':'COMPANY',
                        "CRM_ENTITY_ID":companyList
                    },
                    "SORT": "CRM_ENTITY_ID",
                    'ORDER':'DESC'
                },
                function(result){
                    result.data().forEach(function(call,i){
                        oldCallsToCompanies.push(call);
                    });
                    if (result.more()){
                        result.next();
                    } else {
                        vm.groupOldCallsByCompany(oldCallsToCompanies,callToCompaniesStats);
                    }
                });

        },
        groupOldCallsByCompany: function(oldCallsToCompanies,callToCompaniesStats){
            let groupedCalls=[];
            for (let i=0;i<oldCallsToCompanies.length;i++){
                if (groupedCalls[oldCallsToCompanies[i].CRM_ENTITY_ID]===undefined){
                    groupedCalls[oldCallsToCompanies[i].CRM_ENTITY_ID]=[];
                }
                groupedCalls[oldCallsToCompanies[i].CRM_ENTITY_ID].push(oldCallsToCompanies[i]);
            }
            vm.getLastOldCallForCompanies(groupedCalls,callToCompaniesStats);
        },
        getLastOldCallForCompanies: function(groupedCalls,callToCompaniesStats){
            let filteredCalls=[];
            groupedCalls.forEach(function (group) {
                if (group.length===1)
                {
                    filteredCalls.push(group[0])
                }
                else
                {
                    let max = group[0].ID;
                    group.forEach(function (call) {
                        if (max<call.ID)
                        {
                            max=call.ID;
                        }
                    });
                    group.forEach(function (call) {
                        if (max===call.ID)
                        {
                            filteredCalls.push(call);
                        }
                    });
                }
            });
            vm.setBeforePeriodCallsToCompanies(filteredCalls,callToCompaniesStats);
        },
        setBeforePeriodCallsToCompanies(filteredCalls,callToCompaniesStats){
            filteredCalls.forEach(function (call) {
                callToCompaniesStats.forEach(function (callToCompany) {
                    if (callToCompany.CRM_ENTITY_ID==call.CRM_ENTITY_ID&&callToCompany.BEFORE_CALL_DATE===undefined){
                        callToCompany.BEFORE_CALL_DATE=call.CALL_START_DATE;
                    }
                });
            });
            vm.getActivities(callToCompaniesStats);
        },
        getActivities: function(callToCompaniesStats){
            let activitiesID=[];
            let activitiesData=[];
            callToCompaniesStats.forEach(function (call) {
                activitiesID.push(call.CRM_ACTIVITY_ID);
            });
            BX24.callMethod(
                "crm.activity.list",
                {
                    order:{ "ID": "DESC" },
                    filter:
                        {
                            "ID": activitiesID,
                        },
                    select:[ "SUBJECT", "ID" ]
                },
                function(result)
                {
                    result.data().forEach(function (activity) {
                        activitiesData.push(activity);
                    });
                    if(result.more())
                    {
                        result.next();
                    }
                    else
                    {
                        vm.moveActivitiesDataToStats(activitiesData,callToCompaniesStats);
                    }

                }
            );

        },
        moveActivitiesDataToStats: function(activitiesData,callToCompaniesStats){
            activitiesData.forEach(function (activity) {
                callToCompaniesStats.forEach(function (stat) {
                    if (stat.CRM_ACTIVITY_ID===activity.ID){
                        stat.ACTIVITY_SUBJECT=activity.SUBJECT;
                    }
                });
            });
            vm.getCallsGroupByCompany(callToCompaniesStats);
        },
        getCallsGroupByCompany: function(callToCompaniesStats){
            let callStats=[];
            for (i=0;i<callToCompaniesStats.length;i++){
                if (callStats[callToCompaniesStats[i].CRM_ENTITY_ID]===undefined){
                    callStats[callToCompaniesStats[i].CRM_ENTITY_ID]=[];
                }
                callStats[callToCompaniesStats[i].CRM_ENTITY_ID].push(callToCompaniesStats[i]);
            }
            vm.getRowsData(callStats);
        },
        getRowsData: function(callStats){
            let rowsCount=0;
            let succedCount=0;
            callStats.forEach(function (stat,i) {
                if (stat.length>1){
                    let max = stat[0].ID;
                    stat.forEach(function (call) {
                        if (max<call.ID)
                        {
                            max=call.ID;
                        }
                    });
                    stat.forEach(function (call) {
                        if (max!==call.ID)
                        {
                            call.MAIN_ROW=false;
                        }
                    });
                }
            });
            callStats.forEach(function (stats,i) {
                rowsCount++;
                stats.forEach(function (stat) {
                    stat.HAS_NEXT&&stat.MAIN_ROW&&parseInt(stat.CALL_DURATION,10)>45?succedCount++:"";
                });
            });
            vm.createReportRows(callStats,rowsCount,succedCount);
        },
        createReportRows: function(callStats,rowsCount,succedCount){
            let rows = '';
            let totalRow=`<tr class="total-row">
                <td>ИТОГО</td>
                <td>Уникальных</td>
                <td class="unique-count">${rowsCount}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td>Уникальных и выполненных</td>
                <td class="success-count">${succedCount}</td>
                <td></td>
                <td></td>
            </tr>`;
            callStats.forEach(function (stats) {
                stats.forEach(function (stat) {
                    if (stat.MAIN_ROW===true)
                    {
                        rows+=`<tr class="${stat.CRM_ACTIVITY_ID} main-row">
                            <td class="activity-id">${stat.CRM_ACTIVITY_ID}</td>
                            <td class="compnay-name">${stat.COMPANY_TITLE}</td>
                            <td class="count">1</td>
                            <td class="phone-number">${stat.PHONE_NUMBER}</td>
                            <td class="call-direction">${stat.CALL_TYPE==='1'?'Исходящий':"Входящий"}</td>                            
                            <td class="call-before-date">${stat.BEFORE_CALL_DATE!=undefined?stat.BEFORE_CALL_DATE.substr(0,10):'нет'}</td>
                            <td class="call-date">${stat.CALL_START_DATE.substr(0,10)}</td>
                            <td class="resbonsible">${stat.RESPONSIBLE}</td>
                            <td class="activity-subject">${stat.ACTIVITY_SUBJECT}</td>
                            <td class="status">${stat.HAS_NEXT&&parseInt(stat.CALL_DURATION,10)>45?'Выполнено':" Не выполнено"}</td>
                            <td class="call-duration">${stat.CALL_DURATION}</td>
                            <td class="next-call-date">${stat.HAS_NEXT?stat.NEXT_CALL_DATE.substr(0,10) :'нет'}</td>
                        </tr>`;
                    }
                    else
                    {
                        rows+=`<tr class="${stat.CRM_ACTIVITY_ID} secondary-row">
                            <td class="activity-id">${stat.CRM_ACTIVITY_ID}</td>
                            <td class="compnay-name">${stat.COMPANY_TITLE}</td>
                            <td class="count">0</td>
                            <td class="phone-number">${stat.PHONE_NUMBER}</td>
                            <td class="call-direction">${stat.CALL_TYPE==='1'?'Исходящий':"Входящий"}</td>                            
                            <td class="call-before-date">${stat.BEFORE_CALL_DATE!=undefined?stat.BEFORE_CALL_DATE.substr(0,10):'нет'}</td>
                            <td class="call-date">${stat.CALL_START_DATE.substr(0,10)}</td>
                            <td class="resbonsible">${stat.RESPONSIBLE}</td>
                            <td class="activity-subject">${stat.ACTIVITY_SUBJECT}</td>
                            <td class="status">${stat.HAS_NEXT&&parseInt(stat.CALL_DURATION,10)>45?'Выполнено':" Не выполнено"}</td>
                            <td class="call-duration">${stat.CALL_DURATION}</td>
                            <td class="next-call-date">${stat.HAS_NEXT?stat.NEXT_CALL_DATE.substr(0,10) :'нет'}</td>
                        </tr>`;
                    }
                });
            });
            vm.addTableToDOM(rows,totalRow);
        },
        addTableToDOM: function (rows,totalRow) {
            let table = '<table id="statsTable" class="table table-bordered table-hover filterTable"><tbody>\n' +
                '                <tr class="labelRow info">\n' +
                '                    <td>ID дела</td>\n' +
                '                    <td>Клиент</td>\n' +
                '                    <td>Количество уникальных</td>\n' +
                '                    <td>Телефон</td>\n' +
                '                    <td>Направление</td>\n' +
                '                    <td>Дата последнего контакта до периода</td>\n' +
                '                    <td>Дата создания</td>\n' +
                '                    <td>Ответственный</td> \n' +
                '                    <td>Тема</td>\n' +
                '                    <td>Статус</td>\n' +
                '                    <td>Длительность, с</td>\n' +
                '                    <td>Дата следующего взаимодействия</td>\n' +
                '                </tr>\n' +rows+totalRow+
                '            </tbody></table>';
            document.querySelector('#app').insertAdjacentHTML('beforeEnd',table);
            this.report.title = 'Отчёт';
        }
    }
});





