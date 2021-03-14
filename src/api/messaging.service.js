import axios from "axios";

import { computed, ref, watch } from "vue";
import { useStore } from "vuex";

export const Messages = () => {
  const store = useStore();
  const body = ref("");
  const group = computed(() => store.state.group);
  const messageList = ref([]);
  const serverURL = computed(() => store.state.serverURL);
  const user = computed(() => store.state.user);

  function FormatDate(date) {
    let dd = "AM";
    let hh = date.getHours();
    let m = date.getMinutes();
    let h = hh;
    if (hh >= 12) {
      h = hh - 12;
      dd = "PM";
    }
    if (h == 0) {
      h = 12;
    }
    h = h < 10 ? "0" + h : h;
    m = m < 10 ? "0" + m : m;
    return h + ":" + m + " " + dd;
  }

  function PreprocessMessage(message) {
    let newCreatedAt = new Date(message.createdAt);
    message.createdAt = FormatDate(newCreatedAt);
    return message;
  }

  async function GetMessages() {
    var url = serverURL.value + "v1/channels/" + group.value.id;
    let sessionToken = localStorage.getItem("auth");

    // send a get request with the above data
    axios
      .get(url, {
        headers: {
          Authorization: sessionToken
        }
      })
      .then(response => {
        let messages = response.data;
        if (!messages) {
          return;
        }
        messageList.value = [];
        messages
          .slice()
          .reverse()
          .forEach(message => {
            message = PreprocessMessage(message);
            messageList.value.push(message);
          });
      })
      .catch(error => {
        alert(error);
      });
  }
  async function SendMessage() {
    var url = serverURL.value + "v1/channels/" + group.value.id;
    let sessionToken = localStorage.getItem("auth");

    // Get user first name from store & add it to this object
    let date = new Date();
    let formattedDate = FormatDate(date);
    let messageObject = {
      channelID: group.value.id,
      body: body,
      createdAt: formattedDate,
      creator: user
    };
    // Setting the msg id locally to -1 (will self-correct on page refresh)
    let temporary = messageObject;
    temporary.id = "-1";
    messageList.value.push(temporary);
    // send a get request with the above data
    axios
      .post(url, messageObject, {
        headers: {
          Authorization: sessionToken
        }
      })
      .then(() => {
        body.value = "";
      })
      .catch(error => {
        alert(error);
      });
  }

  return {
    body,
    group,
    messageList,
    FormatDate,
    GetMessages,
    PreprocessMessage,
    SendMessage
  };
};

export const Groups = () => {
  const store = useStore();
  const awaitingGroupDetails = ref(false);
  const description = ref("");
  const general = computed(() => store.state.general);
  const groupBuffer = computed(() => store.state.groupBuffer);
  const groupID = ref("");
  const groups = computed(() => store.state.groupList);
  const index = ref(-1);
  const isModalTypeUpdate = groupBuffer.value.type === "update";
  const members = ref([]);
  const memberIDs = ref([]);
  const memberNames = ref([]);
  const name = ref("");
  const serverURL = computed(() => store.state.serverURL);

  function updateDetailsWatchHandler(oldValue) {
    // Don't update when previous was empty
    if (oldValue === "") {
      return;
    }
    if (!awaitingGroupDetails.value) {
      setTimeout(() => {
        UpdateGroupDetails();
        awaitingGroupDetails.value = false;
      }, 1000); // 1 sec delay
    }
    awaitingGroupDetails.value = true;
  }
  if (isModalTypeUpdate) {
    groupID.value = groupBuffer.value.group.id;
    watch(name, (_, oldValue) => updateDetailsWatchHandler(oldValue));
    watch(description, (_, oldValue) => updateDetailsWatchHandler(oldValue));
  }

  watch(
    members,
    () => {
      memberIDs.value = [];
      memberNames.value = [];
      members.value.forEach(member => memberIDs.value.push(member.id));
      members.value.forEach(member => memberNames.value.push(member.name));
    },
    {
      deep: true
    }
  );

  async function GetSpecificGroup(groupName) {
    var url = serverURL.value + "v1/channels?startsWith=" + groupName;
    let sessionToken = localStorage.getItem("auth");
    // send a get request with the above data
    let groups = await axios
      .get(url, {
        headers: {
          Authorization: sessionToken
        }
      })
      .then(response => {
        return response.data;
      })
      .catch(error => {
        alert(error);
      });
    return groups;
  }

  async function GetGeneralGroup() {
    let groups = await GetSpecificGroup("General");
    let general = groups[0];
    store.commit("setGroup", {
      group: general
    });
    store.commit("setGeneral", {
      group: general
    });
  }

  async function CreateGroup() {
    if (members.value.length == 0) {
      alert("Error: Invalid New Group Input");
      return;
    }
    let url = serverURL.value + "v1/channels";
    let sessionToken = localStorage.getItem("auth");
    let names = memberNames.value.toString();
    let ids = memberIDs.value;
    let date = new Date();
    // title = title.substring(1, title.length - 2);
    // Create Group object
    let groupObject = {
      name: names,
      description: "*Enter a description*",
      private: true,
      members: ids,
      createdAt: date,
      editedAt: null
    };
    let headers = { Authorization: sessionToken };
    let requestConfig = {
      method: "post",
      url: url,
      headers: headers,
      data: groupObject
    };
    await axios(requestConfig)
      .then(response => {
        let newGroup = response.data;
        let index = groups.value.length;
        newGroup.index = index;
        store.commit("addToGroupList", {
          group: newGroup
        });
      })
      .catch(error => {
        alert(error);
      });
  }
  async function GetGroups() {
    var url = serverURL.value + "v1/channels";
    let sessionToken = localStorage.getItem("auth");

    // send a get request with the above data
    axios
      .get(url, {
        headers: {
          Authorization: sessionToken
        }
      })
      .then(response => {
        if (response == null) {
          return;
        }
        store.commit("clearGroupList");
        let receivedGroups = response.data;
        receivedGroups.forEach((group, index) => {
          group.index = index;
        });
        store.commit("setGroupList", {
          groupList: receivedGroups
        });
      })
      .catch(error => {
        alert(error);
      });
  }
  async function UpdateGroupDetails() {
    // Update name & description
    let url = serverURL.value + "v1/channels/" + groupID.value;
    let sessionToken = localStorage.getItem("auth");
    let body = {
      name: name.value,
      description: description.value
    };

    axios
      .patch(url, body, {
        headers: {
          Authorization: sessionToken
        }
      })
      .then(response => {
        // The type field allows groupList to properly consume the changes to the group
        let updatedGroup = response.data;
        updatedGroup.index = index.value;
        store.commit("updateGroupInGroupList", {
          index: index.value,
          group: updatedGroup
        });
      })
      .catch(error => {
        alert(error);
      });
  }
  async function DeleteGroup() {
    if (!confirm("Are you sure you want to delete this group?")) {
      return;
    }
    let url = serverURL.value + "v1/channels/" + groupID.value;
    let sessionToken = localStorage.getItem("auth");
    axios
      .delete(url, {
        headers: {
          Authorization: sessionToken
        }
      })
      .then(() => {
        // Go back to the general group when deleting the channel
        store.commit("removeFromGroupList", {
          index: index.value
        });
        store.commit("setGroup", {
          group: general.value
        });
      })
      .catch(error => {
        alert(error);
      });
  }
  async function AddGroupMember(newMember) {
    if (groupBuffer.value.type === "create") {
      let member = {
        id: newMember.id,
        name: newMember.text
      };
      members.value.push(member);
      return;
    }
    let url = serverURL.value + "v1/channels/" + groupID.value + "/members";
    let headers = { Authorization: localStorage.getItem("auth") };
    let body = { id: newMember.id };
    let requestConfig = {
      method: "post",
      url: url,
      headers: headers,
      data: body
    };

    axios(requestConfig)
      .then(() => {
        let member = {
          id: newMember.id,
          name: newMember.text
        };
        // The type field allows groupList to properly consume the changes to the group
        members.value.push(member);
        let updatedGroup = groupBuffer.value.group;
        updatedGroup.members = members.value;
        store.commit("updateGroupInGroupList", {
          index: index.value,
          group: updatedGroup
        });
      })
      .catch(error => {
        alert(error);
      });
  }
  async function RemoveGroupMember(memberIndex) {
    if (groupBuffer.value.type === "create") {
      members.value.splice(memberIndex, 1);
      return;
    }
    let id = members.value[memberIndex].id;
    // Parse members & add them to new group obj before sending request
    let url = serverURL.value + "v1/channels/" + groupID.value + "/members";
    let sessionToken = localStorage.getItem("auth");
    let data = {
      id: id
    };
    let headers = {
      Authorization: sessionToken
    };
    axios
      .delete(url, {
        headers,
        data
      })
      .then(() => {
        // The type field allows groupList to properly consume the changes to the group
        members.value.splice(memberIndex, 1);
        let updatedGroup = groupBuffer.value.group;
        updatedGroup.members = members.value;
        store.commit("updateGroupInGroupList", {
          index: index.value,
          group: updatedGroup
        });
      })
      .catch(error => {
        alert(error);
      });
  }
  return {
    description,
    groupBuffer,
    groupID,
    groups,
    index,
    isModalTypeUpdate,
    members,
    memberIDs,
    memberNames,
    name,
    GetSpecificGroup,
    GetGeneralGroup,
    CreateGroup,
    UpdateGroupDetails,
    GetGroups,
    DeleteGroup,
    AddGroupMember,
    RemoveGroupMember
  };
};
