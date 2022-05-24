const baseUrl = "https://tmwlelsoe6.execute-api.us-east-1.amazonaws.com/Prod/"; // TODO: This needs to be replaced
const form = document.getElementsByClassName("form-signin")[0];

const showAlert = (cssClass, message) => {
  const html = `
    <div class="alert alert-${cssClass} alert-dismissible" role="alert">
        <strong>${message}</strong>
        <button class="close" type="button" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">×</span>
        </button>
    </div>`;

  document.querySelector("#alert").innerHTML += html;
};

const showRedirect = (cssClass, message, redirect_url) => {
  const html = `
    <div class="alert alert-${cssClass} alert-dismissible" role="alert">
        <strong>${message}</strong>
        <button class="close" type="button" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">×</span>
        </button>
    </div>`;

  const button = `
    <a href="https://${redirect_url}">
      <input type="button" value="Login" />
    </a>`;

  document.querySelector("#redirect").innerHTML += html;
  document.querySelector("#redirect-button").innerHTML += button;
};

const formToJSON = (elements) =>
  [].reduce.call(
    elements,
    (data, element) => {
      data[element.name] = element.value;
      return data;
    },
    {}
  );

const getUrlParameter = (name) => {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  const regex = new RegExp(`[\\?&]${name}=([^&#]*)`);
  const results = regex.exec(location.search);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
};

const handleFormSubmit = (event) => {
  event.preventDefault();

  const postUrl = `${baseUrl}subscriber`;
  const regToken = getUrlParameter("x-amzn-marketplace-token");

  if (!regToken) {
    showAlert(
      "danger",
      "Registration Token Missing. Please go to AWS Marketplace and follow the instructions to set up your account!"
    );
  } else {
    const data = formToJSON(form.elements);
    data.regToken = regToken;

    const xhr = new XMLHttpRequest();

    xhr.open("POST", postUrl, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));

    xhr.onreadystatechange = () => {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        showAlert("primary", xhr.responseText);
        console.log(JSON.stringify(xhr.responseText));
      }
    };
  }
};

form.addEventListener("submit", handleFormSubmit);

const redirect_url = getUrlParameter("redirect-url");
if (redirect_url) {
  showRedirect(
    "danger",
    `It appears you have already filled this form. If you meant to login to your environment, please click here`,
    redirect_url
  );
}

const regToken = getUrlParameter("x-amzn-marketplace-token");
if (!regToken) {
  showAlert(
    "danger",
    "Registration Token Missing. Please go to AWS Marketplace and follow the instructions to set up your account!"
  );
}

if (!baseUrl) {
  showAlert("danger", "Please update the baseUrl");
}
