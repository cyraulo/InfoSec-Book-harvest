import { Link } from 'react-router-dom';
import { policyVersion } from '../../shared/policies.js';
import { useResource } from './api';
import { Heading, Result } from './shared';

function Contact({ store, privacy }) {
  const email = privacy ? store.privacyEmail : store.email;
  return <>
    <p>{store.name}{store.address && <><br />{store.address}</>}</p>
    {email && <p><a href={'mailto:' + email}>{email}</a></p>}
    {!privacy && store.phone && <p>{store.phone}</p>}
    {!email && <p>For this local demonstration, contact the project operator directly.</p>}
  </>;
}

export function Policies({ kind }) {
  const resource = useResource('/store-info');
  const privacy = kind === 'privacy';
  return <article className="policy-page">
    <Heading title={privacy ? 'Privacy notice' : 'Terms and conditions'}>Effective {policyVersion}</Heading>
    <Result resource={resource}>{store => privacy ? <>
      <h2>Who handles your information</h2>
      <Contact store={store} privacy />
      <h2>Information we use</h2>
      <p>We use your name and email to provide your account. We store a salted password hash. When you order, we use the recipient’s name, address and phone number to deliver the order and resolve related requests. Cash on delivery requires no card details.</p>
      <h2>Why we use it and who can access it</h2>
      <p>We use this information to provide your account, fulfill orders, protect the service and meet applicable legal obligations. Access is limited to authorized staff and the providers needed for hosting, storing or delivering orders. Delivery providers receive the details needed for delivery.</p>
      <p>An essential session cookie keeps you signed in for up to seven days. The app does not use advertising or analytics cookies. The service uses IP addresses in memory to limit abusive requests.</p>
      <h2>Retention and your rights</h2>
      <p>{store.retention || 'The operator manages demonstration account and order data and can remove it on request.'}</p>
      <p>Contact the privacy address above to ask for access, correction, a copy, objection, or deletion or blocking where applicable. We may verify your identity and retain information required for lawful purposes. You may also lodge a complaint with the <a href="https://privacy.gov.ph/">National Privacy Commission</a>.</p>
    </> : <>
      <h2>Seller and customer support</h2>
      <Contact store={store} />
      <h2>Prices, orders and delivery</h2>
      <p>Prices are in Philippine pesos. Review your items, total and delivery details before submitting. Payment is by cash on delivery. An order receipt records your request. Check the order page for confirmation and fulfillment updates.</p>
      {store.delivery && <p>{store.delivery}</p>}
      <h2>Cancellations, returns and complaints</h2>
      <p>Contact customer support with your order number to request cancellation before shipping or report a missing, incorrect or defective item. Applicable consumer rights and remedies continue to apply. Do not send passwords or payment credentials in a support request.</p>
      <p>See the <Link to="/privacy">Privacy notice</Link> for information about your account and order data.</p>
    </>}</Result>
  </article>;
}
